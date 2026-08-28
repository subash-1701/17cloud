let currentFile = "";
let currentUrl = "";
let currentFilter = "all";
let currentView = "files";
let currentUser = "";

/* ================= LOGIN ================= */
async function login() {
  const username = document.getElementById("usernameInput").value.trim().toLowerCase();
  const password = document.getElementById("passwordInput").value;

  if (!username || !password) {
    alert("Enter username and password");
    return;
  }

  const res = await fetch('/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({

  firstName: document.getElementById("firstName").value,
  lastName: document.getElementById("lastName").value,

  email: document.getElementById("email").value,
  phone: document.getElementById("phone").value,

  dob: document.getElementById("dob").value,
  gender: document.getElementById("gender").value,

  username,
  password

})
  });

  const d = await res.json();

  if (d.success) {
    pinScreen.style.display = "none";
    mainApp.style.display = "block";

    const me = await fetch('/me');
    const data = await me.json();
    currentUser = data.user;

    loadFiles();
  } else {
    alert("Wrong login");
  }
}


/*==== BACK TO LOGIN ====*/
function backToLogin() {
  document.getElementById("signupPage").style.display = "none";
  document.getElementById("pinScreen").style.display = "flex";

  // reset form to step 1
  showStep(1);

  // optional: clear inputs
  document.querySelectorAll("#signupPage input").forEach(i => i.value = "");
}


/* ================= SIGNUP ================= */
async function signup() {

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();

  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  const dob = document.getElementById("dob").value;
  const gender = document.getElementById("gender").value;

  const username = document.getElementById("signupUser").value.trim().toLowerCase();

  const password = document.getElementById("signupPass").value;
  const confirm = document.getElementById("confirmPass").value;

  if (!username || username.length < 5) {
    alert("Username must be at least 5 characters");
    return;
  }

  if (!password || password.length < 8) {
    alert("Password must be at least 8 characters");
    return;
  }

  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }

  try {

    const res = await fetch('/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        firstName,
        lastName,
        email,
        phone,
        dob,
        gender,
        username,
        password

      })
    });

    const data = await res.json();

    if (data.success) {

      alert("Your account has been created successfully! 🎉");

      document.getElementById("signupPage").style.display = "none";
      document.getElementById("pinScreen").style.display = "flex";

      showStep(1);

    } else {

      alert(data.message || "Signup failed");

    }

  } catch (err) {

    console.error(err);
    alert("Server error");

  }

}


/* ================= NAV ================= */
function openSignup() {
  document.getElementById("pinScreen").style.display = "none";
  document.getElementById("signupPage").style.display = "flex";
}

/* ================= FILTER ================= */
function setFilter(type) {
  currentFilter = type;

  document.querySelectorAll('.filter-card')
    .forEach(el => el.classList.remove('active'));

  event.currentTarget.classList.add('active');

  if (type === "trash") openTrash();
  else loadFiles();
}

/* ================= VIEWER ================= */
function openViewer(url, file) {
  currentUrl = url;
  currentFile = file;

  const ext = file.split('.').pop().toLowerCase();
  const viewer = document.getElementById("viewer");

  viewer.style.display = "flex";

  let content = "";

  if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
    content = `<img src="${url}" style="max-width:90%; max-height:80%;">`;
  } 
  else if (["mp4","webm","ogg"].includes(ext)) {
    content = `<video src="${url}" controls autoplay style="max-width:90%; max-height:80%;"></video>`;
  } 
  else if (["mp3","wav","ogg"].includes(ext)) {
    content = `<audio controls autoplay style="width:90%;"><source src="${url}"></audio>`;
  } 
  else if (ext === "pdf") {
    content = `<iframe src="${url}" style="width:90%; height:80%;"></iframe>`;
  } 
  else {
    content = `<div>📄 ${file}</div>`;
  }

  let buttons = "";

  if (currentView === "trash") {
    buttons = `
      <button onclick="restoreFile('${file}')">♻️</button>
      <button onclick="permanentDelete('${file}')">🗑</button>
      <button onclick="closeViewer()">✖</button>
    `;
  } else {
    buttons = `
      <button onclick="shareFile()">🔗</button>
      <button onclick="downloadFile()">📥</button>
      <button onclick="deleteFile()">🗑</button>
      <button onclick="closeViewer()">✖</button>
    `;
  }

  viewer.innerHTML = content + `<div id="bottomBar">${buttons}</div>`;
}

function closeViewer() {
  const viewer = document.getElementById("viewer");
  viewer.style.display = "none";
  viewer.innerHTML = "";
}

/* ================= ACTIONS ================= */
function downloadFile() {
  const a = document.createElement("a");
  a.href = currentUrl;
  a.download = "";
  a.click();
}

function shareFile() {
  if (navigator.share) {
    navigator.share({ url: window.location.origin + currentUrl });
  } else {
    alert("Sharing not supported");
  }
}

function deleteFile() {
  if (!confirm("Delete this file?")) return;

  fetch('/photo/' + currentFile, { method:'DELETE' })
    .then(() => {
      closeViewer();
      loadFiles();
    });
}

function restoreFile(name) {
  if (!confirm("Restore this file?")) return;

  fetch('/restore', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ name })
  }).then(() => {
    closeViewer();
    openTrash();
  });
}

function permanentDelete(name) {
  if (!confirm("Delete permanently?")) return;

  fetch('/permanent', {
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ name })
  }).then(() => {
    closeViewer();
    openTrash();
  });
}

/* ================= UPLOAD ================= */
fileInput.addEventListener('change', async e => {
  const files = e.target.files;

  const loader = document.getElementById("uploadLoader");
  const percentUI = document.getElementById("bigPercent");

  loader.style.display = "flex";

  for (let i = 0; i < files.length; i++) {
    await uploadWithProgress(files[i], percentUI);
  }

  // smooth finish
  percentUI.innerText = "100%";

  setTimeout(() => {
    loader.style.display = "none";
    percentUI.innerText = "0%";
  }, 400);

  loadFiles();
});

/* ================= LOAD FILES ================= */
async function loadFiles(){
  currentView = "files";

  const res = await fetch('/photos');
  const files = await res.json();

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  files.forEach(file=>{
    const ext = file.split('.').pop().toLowerCase();

    if(currentFilter==="image" && !["jpg","jpeg","png","gif","webp"].includes(ext)) return;
    if(currentFilter==="video" && !["mp4","webm","ogg"].includes(ext)) return;

    const url = `/uploads/${currentUser}/${file}`;

    grid.innerHTML += `
      <div class="card" onclick="openViewer('${url}','${file}')">
        ${
          ["jpg","jpeg","png","gif","webp"].includes(ext)
          ? `<img src="${url}">`
          : ["mp4","webm","ogg"].includes(ext)
          ? `<video src="${url}" muted></video>`
          : `<div class="file-box">📄</div>`
        }
      </div>
    `;
  });
}

/* ================= TRASH ================= */
async function openTrash() {
  currentView = "trash";

  const res = await fetch('/trash');
  const files = await res.json();

  const grid = document.getElementById("grid");   // ✅ FIXED BUG
  grid.innerHTML = "";

  files.forEach(file => {
    const original = file.split("__").slice(1).join("__");
    const ext = original.split('.').pop().toLowerCase();

    const url = `/trash/${currentUser}/${file}`;

    grid.innerHTML += `
      <div class="card" onclick="openViewer('${url}','${file}')">
        ${["jpg","png","jpeg","webp","gif"].includes(ext)
          ? `<img src="${url}">`
          : ["mp4","webm","ogg"].includes(ext)
          ? `<video src="${url}" muted></video>`
          : `<div class="file-box">🗑</div>`
        }
      </div>
    `;
  });
}


/* ====SIGN UP STEPPER FORM ========*/
let step = 1;
const totalSteps = 5;

function showStep(n) {
  step = n;

  document.querySelectorAll(".step").forEach(s => s.style.display = "none");
  document.getElementById("step" + n).style.display = "block";

  document.getElementById("stepIndicator").innerText = `Step ${n} / ${totalSteps}`;
}

function nextStep(e) {
  if (e) e.preventDefault();

  // STEP 1
  if (step === 1) {
    const f = document.getElementById("firstName").value.trim();
    const l = document.getElementById("lastName").value.trim();

    if (!f || !l) {
      alert("Enter first & last name");
      return;
    }
  }

  // STEP 2
  if (step === 2) {
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!email) {
      alert("Enter email & phone");
      return;
    }
  }

  // STEP 3
  if (step === 3) {
    const dob = document.getElementById("dob").value;
    const gender = document.getElementById("gender").value;

    if (!dob || !gender) {
      alert("Select DOB & Gender");
      return;
    }
  }
  
    // STEP 4 validation (username)
  if (step === 4) {
    const u = document.getElementById("signupUser").value.trim();
    if (!u || u.length < 5) {
      alert("Username min 5 chars");
      return;
    }
  }

  // STEP 5 validation (password)
  if (step === 5) {
    const p = document.getElementById("signupPass").value;
    const c = document.getElementById("confirmPass").value;

    if (!p || p.length < 8) {
      alert("Password min 8 chars");
      return;
    }

    if (p !== c) {
      alert("Passwords do not match");
      return;
    }
  }

  if (step < totalSteps) {
    showStep(step + 1);
  }
}

function prevStep(e) {
  if (e) e.preventDefault();
  showStep(step - 1);
}

function openSignup() {
  document.getElementById("pinScreen").style.display = "none";
  document.getElementById("signupPage").style.display = "flex";
  showStep(1);
}


/* ====== LIVE CHECK USERNAME=======*/
let checkTimeout;

function checkUsername() {
  const username = document.getElementById("signupUser").value;
  const text = document.getElementById("userCheckText");

  if (username.length < 5) {
    text.innerText = "Minimum 5 chars";
    text.style.color = "orange";
    return;
  }

  clearTimeout(checkTimeout);

  checkTimeout = setTimeout(async () => {
    const res = await fetch('/check-username/' + username);
    const data = await res.json();

    if (data.exists) {
      text.innerText = "❌ Username already taken";
      text.style.color = "red";
    } else {
      text.innerText = "✅ Username available";
      text.style.color = "limegreen";
    }
  }, 400);
}

/* ===== PASSWORD VALIDATION ===== */
function checkPassword() {
  const pass = document.getElementById("signupPass").value;
  const hint = document.getElementById("passHint");

  if (pass.length < 8) {
    hint.innerText = "❌ Minimum 8 characters";
    hint.style.color = "red";
  } else {
    hint.innerText = "✅ Strong password";
    hint.style.color = "limegreen";
  }
}

/* ===== CONFIRM PASSWORD ===== */
function checkConfirmPassword() {
  const pass = document.getElementById("signupPass").value;
  const confirm = document.getElementById("confirmPass").value;
  const hint = document.getElementById("confirmHint");

  if (confirm.length === 0) {
    hint.innerText = "";
    return;
  }

  if (pass !== confirm) {
    hint.innerText = "❌ Password not match";
    hint.style.color = "red";
  } else {
    hint.innerText = "✅ Password match";
    hint.style.color = "limegreen";
  }
}

/*===== PASSWORD HINT=======*/

function checkPassword() {
  const p = document.getElementById("signupPass").value;
  const hint = document.getElementById("passHint");

  if (p.length === 0) {
    hint.innerText = "";
  } else if (p.length < 8) {
    hint.innerText = "⚠ Minimum 8 characters";
    hint.style.color = "orange";
  } else {
    hint.innerText = "✅ Strong password";
    hint.style.color = "limegreen";
  }
}

function uploadWithProgress(file, percentUI) {
  return new Promise((resolve, reject) => {

    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('photo', file);

    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        percentUI.innerText = percent + "%";
      }
    };

    xhr.onload = function () {
      resolve();
    };

    xhr.onerror = function () {
      reject();
    };

    xhr.send(fd);
  });
}