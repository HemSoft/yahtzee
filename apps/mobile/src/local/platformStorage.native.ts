import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { createSqliteStorage, DATABASE_NAME, removeDatabaseFiles } from "./sqliteStorage";

export const createPlatformStorage = () => createSqliteStorage({
  open: () => SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }),
  remove: () => removeDatabaseFiles(SQLite.deleteDatabaseAsync),
}, AsyncStorage);
