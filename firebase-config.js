// Firebase 主控台「專案設定 → 你的應用程式」的 firebaseConfig。
// 這組設定本來就是要放在網頁裡的公開識別碼，資料安全靠 firestore.rules 保護。
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCC_Td8BZ90q6q8-pZ_WkAj_mQUVPUIZFQ",
  authDomain: "invest-helper-4955a.firebaseapp.com",
  projectId: "invest-helper-4955a",
  storageBucket: "invest-helper-4955a.firebasestorage.app",
  messagingSenderId: "477259419830",
  appId: "1:477259419830:web:4f1755edb4c421ad681617"
};
// 推播的公開金鑰（私鑰只存在 GitHub Secrets 的 VAPID_PRIVATE）
window.VAPID_PUBLIC = "BBoeRYpwC3xkgQIOZjXoOWn0OIZ2wfQ0R_24Cq8FDp9wtPiMilT5MOByI_zR2rwWPEdlSalqmxhiCQ8sCC5aLYI";
