// ============================================================
// API CONFIGURATION
// ============================================================

const API = "https://drowziness.onrender.com";


// ============================================================
// GET ROLE FROM URL / LOCAL STORAGE
// ============================================================

const params = new URLSearchParams(window.location.search);

let role =
    params.get("role") ||
    localStorage.getItem("selectedRole") ||
    "driver";

let tab = "login";


// ============================================================
// INITIALIZE
// ============================================================

function init() {
    applyRole();
    setTab("login");
}


// ============================================================
// APPLY DRIVER / STUDENT MODE
// ============================================================

function applyRole() {

    const card = document.getElementById("formCard");
    const pill = document.getElementById("rolePill");

    card.className = "form-card fade-up delay-1 mode-" + role;

    if (role === "driver") {

        pill.className = "role-pill pill-driver";

        document.getElementById("pillText").textContent =
            "Driver Mode";

        document.getElementById("loginBtn").className =
            "submit-btn driver-btn";

        document.getElementById("signupBtn").className =
            "submit-btn driver-btn";

        document
            .getElementById("studentFields")
            .classList.add("hidden");

        document
            .getElementById("driverFields")
            .classList.remove("hidden");

    } else {

        pill.className = "role-pill pill-student";

        document.getElementById("pillText").textContent =
            "Student Mode";

        document.getElementById("loginBtn").className =
            "submit-btn student-btn";

        document.getElementById("signupBtn").className =
            "submit-btn student-btn";

        document
            .getElementById("driverFields")
            .classList.add("hidden");

        document
            .getElementById("studentFields")
            .classList.remove("hidden");
    }

    updateText();
}


// ============================================================
// LOGIN / SIGNUP TABS
// ============================================================

function setTab(t) {

    tab = t;

    document
        .getElementById("loginSection")
        .classList.toggle("hidden", t !== "login");

    document
        .getElementById("signupSection")
        .classList.toggle("hidden", t !== "signup");

    document
        .getElementById("tabLogin")
        .classList.toggle("active", t === "login");

    document
        .getElementById("tabSignup")
        .classList.toggle("active", t === "signup");

    clearMsgs();
    updateText();
}


// ============================================================
// UPDATE TEXT
// ============================================================

function updateText() {

    const isStudent = role === "student";
    const isLogin = tab === "login";

    document.getElementById("formTitle").textContent =
        isLogin
            ? "Welcome back"
            : (isStudent
                ? "Join as Student"
                : "Register as Driver");

    document.getElementById("formSub").textContent =
        isLogin
            ? (isStudent
                ? "Login to your student account"
                : "Login to your driver account")
            : (isStudent
                ? "Create your free student account"
                : "Create your driver account");
}


// ============================================================
// MESSAGES
// ============================================================

function showError(message) {

    document.getElementById("errorMsg").textContent = message;

    document
        .getElementById("successMsg")
        .classList.add("hidden");
}


function showSuccess(message) {

    document.getElementById("successMsg").textContent = message;

    document
        .getElementById("successMsg")
        .classList.remove("hidden");

    document.getElementById("errorMsg").textContent = "";
}


function clearMsgs() {

    document.getElementById("errorMsg").textContent = "";

    document
        .getElementById("successMsg")
        .classList.add("hidden");
}


// ============================================================
// EMAIL VALIDATION
// ============================================================

function validEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ============================================================
// BUTTON LOADING
// ============================================================

function setLoading(buttonId, loading, text) {

    const button = document.getElementById(buttonId);

    button.textContent = loading
        ? text
        : (buttonId === "loginBtn"
            ? "Login"
            : "Create Account");

    button.disabled = loading;
}


// ============================================================
// LOGIN
// ============================================================

async function doLogin() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const pass =
        document.getElementById("loginPass").value;


    // Validation
    if (!email || !pass) {

        showError("Please fill in all fields.");

        return;
    }


    if (!validEmail(email)) {

        showError("Enter a valid email address.");

        return;
    }


    clearMsgs();

    setLoading(
        "loginBtn",
        true,
        "Logging in..."
    );


    try {

        const response = await fetch(
            API + "/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: pass
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            showError(
                data.detail ||
                "Incorrect email or password."
            );

            setLoading(
                "loginBtn",
                false
            );

            return;
        }


        // Save login information
        localStorage.setItem(
            "token",
            data.access_token
        );

        localStorage.setItem(
            "userRole",
            data.role
        );

        localStorage.setItem(
            "userName",
            data.name
        );

        localStorage.setItem(
            "userEmail",
            email
        );


        // Go to dashboard
        window.location.href = "dashboard.html";

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showError(
            "Cannot connect to the server. Please try again."
        );

        setLoading(
            "loginBtn",
            false
        );
    }
}


// ============================================================
// SIGN UP
// ============================================================

async function doSignup() {

    const name =
        document.getElementById("signupName").value.trim();

    const email =
        document.getElementById("signupEmail").value.trim();

    const pass =
        document.getElementById("signupPass").value;


    // Basic validation
    if (!name || !email || !pass) {

        showError(
            "Please fill in all fields."
        );

        return;
    }


    if (!validEmail(email)) {

        showError(
            "Enter a valid email address."
        );

        return;
    }


    if (pass.length < 6) {

        showError(
            "Password must be at least 6 characters."
        );

        return;
    }


    // Basic user information
    let body = {
        name: name,
        email: email,
        password: pass,
        role: role
    };


    // ========================================================
    // STUDENT
    // ========================================================

    if (role === "student") {

        const roll =
            document
                .getElementById("signupRoll")
                .value
                .trim();

        const grade =
            document
                .getElementById("signupClass")
                .value
                .trim();

        const goal =
            document
                .getElementById("signupGoal")
                .value;


        if (!roll || !grade || !goal) {

            showError(
                "Please complete all student fields."
            );

            return;
        }


        body.roll_number = roll;

        body.grade = grade;

        body.study_goal = parseInt(
            goal,
            10
        );
    }


    // ========================================================
    // DRIVER
    // ========================================================

    if (role === "driver") {

        const vehicle =
            document
                .getElementById("signupVehicle")
                .value;

        const license =
            document
                .getElementById("signupLicense")
                .value
                .trim();


        if (!vehicle || !license) {

            showError(
                "Please complete all driver fields."
            );

            return;
        }


        body.vehicle_type = vehicle;

        body.license_number = license;
    }


    clearMsgs();

    setLoading(
        "signupBtn",
        true,
        "Creating account..."
    );


    try {

        const response = await fetch(
            API + "/register",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)
            }
        );


        const data = await response.json();


        if (!response.ok) {

            showError(
                data.detail ||
                "Registration failed. Try again."
            );

            setLoading(
                "signupBtn",
                false
            );

            return;
        }


        showSuccess(
            "Account created successfully! Please login."
        );


        setLoading(
            "signupBtn",
            false
        );


        setTimeout(
            () => setTab("login"),
            1800
        );

    } catch (error) {

        console.error(
            "Signup error:",
            error
        );

        showError(
            "Cannot connect to the server. Please try again."
        );

        setLoading(
            "signupBtn",
            false
        );
    }
}


// ============================================================
// START APPLICATION
// ============================================================

init();