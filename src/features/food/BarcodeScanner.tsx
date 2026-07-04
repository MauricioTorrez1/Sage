import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";

type BarcodeScannerProps = {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
};

/** Full-screen product barcode scanner (EAN/UPC). Fires onScanned once. */
export function BarcodeScanner({
  visible,
  onScanned,
  onClose,
}: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  // The camera keeps reporting the same code every frame; latch the first.
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      if (permission && !permission.granted && permission.canAskAgain) {
        requestPermission();
      }
    }
  }, [visible, permission, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-night">
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={(result) => {
              if (scannedRef.current || !result.data) return;
              scannedRef.current = true;
              onScanned(result.data);
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center font-nunito text-base text-ink-inverse">
              {t("food.cameraPermission")}
            </Text>
            {permission?.canAskAgain ? (
              <View className="mt-4 w-full">
                <Button
                  title={t("food.grantCamera")}
                  onPress={requestPermission}
                />
              </View>
            ) : null}
          </View>
        )}
        <View className="px-6 pb-4 pt-3">
          <Text className="mb-3 text-center font-nunito text-sm text-ink-invmuted">
            {t("food.scanHint")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="items-center rounded-button bg-nightSurface py-3.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="font-nunito-bold text-base text-ink-inverse">
              {t("food.close")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
