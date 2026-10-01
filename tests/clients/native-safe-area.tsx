import React from "react";
import { View, type ViewProps } from "react-native";
// Zero-inset browser adapter. It is not evidence of native safe-area behavior.
export function SafeAreaView({ edges: _edges, ...props }: ViewProps & { edges?: string[] }) {
  return <View {...props} />;
}
