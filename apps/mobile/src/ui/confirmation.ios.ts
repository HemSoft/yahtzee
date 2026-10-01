import { Alert } from "react-native";

export function showConfirmation(title: string, message: string, accept: () => void): boolean {
  Alert.alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: title, style: "destructive", onPress: accept }]);
  return true;
}
