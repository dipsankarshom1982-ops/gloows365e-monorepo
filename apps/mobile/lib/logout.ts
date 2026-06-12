import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";

export const handleLogout = async () => {
  try {
    // 🔥 Firebase logout
    await signOut(auth);

    // 🧹 Clear role
    await AsyncStorage.removeItem("role");

    return true;
  } catch (error) {
    console.log("Logout error:", error);
    return false;
  }
};