// 1) Firebase init (same config)
firebase.initializeApp({
    apiKey: "AIzaSyD80JCME8g97PD1fMu2xQWD6DRJp5bMFSg",
    authDomain: "generos-webapp.firebaseapp.com",
    projectId: "generos-webapp",
    storageBucket: "generos-webapp.appspot.com",
    messagingSenderId: "874489491002",
    appId: "1:874489491002:web:46f893c170bbd944cb8f03"
  });
  const auth = firebase.auth();
  const db   = firebase.firestore();
  
  // 2) Login handler with approval check
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass  = e.target.password.value;
    try {
      // Sign in
      const { user } = await auth.signInWithEmailAndPassword(email, pass);
      // Fetch Firestore user doc
      const userSnap = await db.collection('users').doc(user.uid).get();
      const userData = userSnap.data();
      // If not approved, sign out and alert
      if (!userData || userData.approved !== true) {
        await auth.signOut();
        alert('Sua conta ainda não foi aprovada. Aguarde liberação.');
        return;
      }
      // Approved → redirect
      window.location.href = 'po.html';
    } catch(err) {
      alert('Erro ao entrar: ' + err.message);
      console.error(err);
    }
  });
  
  // Optional: block direct dashboard access
  if (window.location.pathname.includes('dashboard.html')) {
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = 'agendamento.html';
      }
    });
  }
  