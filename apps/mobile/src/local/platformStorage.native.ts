import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { Directory } from "expo-file-system";
import { createSqliteStorage, DATABASE_NAME, removeDatabaseFiles } from "./sqliteStorage";

function databaseFiles() {
  const directory = new Directory(SQLite.defaultDatabaseDirectory);
  // Do not use exists: it can also be false when access is denied.
  if (!directory.parentDirectory.list().some((entry) => entry.name === directory.name)) return [];
  return directory.list().map((entry) => entry.name);
}
export const createPlatformStorage = () => createSqliteStorage({
  open: () => SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }),
  remove: () => removeDatabaseFiles(SQLite.deleteDatabaseAsync, databaseFiles),
}, AsyncStorage);
