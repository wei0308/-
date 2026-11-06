// Firebase 同步：Google 或 Email 登入，資料存在 Firestore 的 users/{uid}，只有本人讀得到（見 firestore.rules）
const V = "10.12.2";
const cfg = window.FIREBASE_CONFIG;
const FB = { configured: !!(cfg && cfg.apiKey), user: null, ready: false };
window.FB = FB;

if (FB.configured) {
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  let unsub = null;
  const ref = () => F.doc(db, "users", FB.user.uid);

  FB.signInGoogle = () => A.signInWithPopup(auth, new A.GoogleAuthProvider());
  FB.signInEmail = (e, p) => A.signInWithEmailAndPassword(auth, e, p);
  FB.signUpEmail = (e, p) => A.createUserWithEmailAndPassword(auth, e, p);
  FB.signOut = () => A.signOut(auth);
  FB.pull = async () => { const s = await F.getDoc(ref()); return s.exists() ? JSON.parse(s.data().json) : null; };
  FB.push = state => {
    const data = structuredClone(state);
    data.settings.apiKey = "";
    return F.setDoc(ref(), { json: JSON.stringify(data), updatedAt: data.updatedAt || Date.now() });
  };

  A.onAuthStateChanged(auth, u => {
    FB.user = u; FB.ready = true;
    if (unsub) { unsub(); unsub = null; }
    // 即時監聽：另一台裝置一寫入，這台就收到
    if (u) unsub = F.onSnapshot(ref(), s => {
      if (s.exists() && !s.metadata.hasPendingWrites) window.dispatchEvent(new CustomEvent("fb-remote", { detail: JSON.parse(s.data().json) }));
    });
    window.dispatchEvent(new CustomEvent("fb-auth", { detail: u }));
  });
} else {
  FB.ready = true;
  window.dispatchEvent(new CustomEvent("fb-auth", { detail: null }));
}
