import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type ProgressPhoto = {
  id: string;
  storage_path: string;
  weight_kg: number | null;
  analysis: string | null;
  created_at: string;
  /** Short-lived display URL for the private bucket object. */
  signedUrl?: string;
};

type ProgressState = {
  /** Newest first. */
  photos: ProgressPhoto[];
  loaded: boolean;
  uploading: boolean;
  /** id of the photo currently being analyzed by Sage. */
  analyzingId: string | null;
  errorKey: string | null;
};

export const useProgressStore = create<ProgressState>(() => ({
  photos: [],
  loaded: false,
  uploading: false,
  analyzingId: null,
  errorKey: null,
}));

const BUCKET = "progress-photos";
const SIGNED_URL_TTL = 3600;
const MAX_PHOTOS = 30;

/** Loads photo rows + display URLs. Idempotent per session. */
export async function loadPhotos() {
  if (useProgressStore.getState().loaded) return;

  const { data, error } = await supabase
    .from("progress_photos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_PHOTOS);

  if (error || !data) {
    useProgressStore.setState({ loaded: true });
    return;
  }

  let photos = data as ProgressPhoto[];
  if (photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(photos.map((p) => p.storage_path), SIGNED_URL_TTL);
    if (signed) {
      photos = photos.map((photo, index) => ({
        ...photo,
        signedUrl: signed[index]?.signedUrl ?? undefined,
      }));
    }
  }
  useProgressStore.setState({ photos, loaded: true });
}

/** Uploads a local image, records it, and kicks off Sage's analysis. */
export async function addPhoto(
  userId: string,
  localUri: string,
  weightKg: number | null,
) {
  if (useProgressStore.getState().uploading) return;
  useProgressStore.setState({ uploading: true, errorKey: null });

  try {
    const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());
    const path = `${userId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arraybuffer, { contentType: "image/jpeg" });
    if (uploadError) throw uploadError;

    const { data: photo, error: insertError } = await supabase
      .from("progress_photos")
      .insert({ user_id: userId, storage_path: path, weight_kg: weightKg })
      .select()
      .single();
    if (insertError || !photo) throw insertError ?? new Error("insert failed");

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    const newPhoto = {
      ...(photo as ProgressPhoto),
      signedUrl: signed?.signedUrl,
    };
    useProgressStore.setState((state) => ({
      photos: [newPhoto, ...state.photos],
      uploading: false,
    }));

    await analyzePhoto(newPhoto.id);
  } catch {
    useProgressStore.setState({
      uploading: false,
      errorKey: "progress.errors.upload",
    });
  }
}

/** Asks Sage to (re)evaluate a photo against the previous one. */
export async function analyzePhoto(photoId: string) {
  if (useProgressStore.getState().analyzingId) return;
  useProgressStore.setState({ analyzingId: photoId, errorKey: null });

  const { data, error } = await supabase.functions.invoke("coach", {
    body: { type: "photo_analysis", photo_id: photoId },
  });

  if (error || typeof data?.analysis !== "string") {
    useProgressStore.setState({
      analyzingId: null,
      errorKey: "progress.errors.analyze",
    });
    return;
  }

  useProgressStore.setState((state) => ({
    photos: state.photos.map((photo) =>
      photo.id === photoId ? { ...photo, analysis: data.analysis } : photo,
    ),
    analyzingId: null,
  }));
}

/** Clears cached photos; call on sign-out. */
export function resetProgress() {
  useProgressStore.setState({
    photos: [],
    loaded: false,
    uploading: false,
    analyzingId: null,
    errorKey: null,
  });
}
