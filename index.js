function toggleMenu(){

let sidebar = document.getElementById("sidebar");

if(sidebar.style.left === "0px"){
sidebar.style.left = "-250px";
}
else{
sidebar.style.left = "0px";
}

}

function selectRole(role){

localStorage.setItem("role",role);
window.location="auth.html";

}

window.onload=function(){

let role = localStorage.getItem("role");

if(document.getElementById("roleTitle") && role){

document.getElementById("roleTitle").innerText =
role.toUpperCase()+" Login";

}

}

function login(){

window.location="dashboard.html";

}