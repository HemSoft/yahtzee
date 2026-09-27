import AsyncStorage from "@react-native-async-storage/async-storage";

/** Web development/fixture adapter; native builds select platformStorage.native.ts. */
export const createPlatformStorage = () => AsyncStorage;
