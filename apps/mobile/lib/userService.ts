// lib/userService.ts

import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

class UserService {
  private static userClassCache: number | null = null;

  // 🔥 Get user class (main function)
  static async getUserClass(): Promise<number | null> {
    try {
      // ✅ return cached value
      if (this.userClassCache) {
        return this.userClassCache;
      }

      const user = getAuth().currentUser;
      if (!user) return null;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) return null;

      const data = snap.data();

      const userClass = data.class || null;

      // ✅ cache it
      this.userClassCache = userClass;

      return userClass;
    } catch (error) {
      console.log("UserService Error:", error);
      return null;
    }
  }

  // 🔥 Clear cache (optional)
  static clearCache() {
    this.userClassCache = null;
  }
}

export default UserService;