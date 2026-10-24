document.querySelectorAll("[data-admin-logout]").forEach(button=>{
  button.addEventListener("click",async()=>{
    button.disabled=true;
    try{
      await fetch("/api/admin/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"});
    }catch{}
    finally{
      location.replace("/admin/login");
    }
  });
});
