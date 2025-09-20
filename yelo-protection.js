// YELO Protection System for Business Bay Contracts
(function() {
  const YELO_BASE_URL = 'https://yelo-dashboard.firebaseapp.com/';
  const PROJECT_NAME = 'contracts';
  
  function checkAuth() {
    const authData = localStorage.getItem('yelo_auth');
    if (!authData) {
      redirectToLogin('No authentication found');
      return false;
    }

    try {
      const parsed = JSON.parse(authData);
      const now = new Date().getTime();
      
      if (!parsed.expiry || now >= parsed.expiry) {
        redirectToLogin('Session expired');
        return false;
      }

      const permissions = parsed.permissions || [];
      if (!permissions.includes('all') && !permissions.includes(PROJECT_NAME)) {
        showAccessDenied();
        return false;
      }

      logAccess(parsed.user);
      showUserBar(parsed.user);
      return true;
      
    } catch (error) {
      redirectToLogin('Authentication error');
      return false;
    }
  }

  function redirectToLogin(reason) {
    alert('Authentication required: ' + reason);
    window.location.href = YELO_BASE_URL + 'login.html';
  }

  function showAccessDenied() {
    document.body.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: Arial;">
        <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px;">
          <i class="fas fa-ban" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
          <h3 style="color: #333; margin-bottom: 15px;">Access Denied</h3>
          <p style="color: #666; margin-bottom: 20px;">You don't have permission to access Business Bay Contracts.<br>Contact the administrator for access.</p>
          <a href="${YELO_BASE_URL}" style="background: #6a1b9a; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Back to Dashboard</a>
        </div>
      </div>
    `;
  }

  function showUserBar(user) {
    const userBar = document.createElement('div');
    userBar.style.cssText = 'position: fixed; top: 0; right: 0; background: rgba(106, 27, 154, 0.95); color: white; padding: 10px 20px; border-radius: 0 0 0 15px; z-index: 1000; display: flex; align-items: center; gap: 15px;';
    
    userBar.innerHTML = `
      <span><i class="fas fa-user-circle"></i> ${user.username}</span>
      <a href="${YELO_BASE_URL}" style="background: rgba(255, 214, 0, 0.2); border: 1px solid #ffd600; color: #ffd600; padding: 5px 12px; border-radius: 8px; text-decoration: none; font-size: 12px;">Dashboard</a>
      <button onclick="yeloLogout()" style="background: rgba(255, 0, 0, 0.2); border: 1px solid #ff4444; color: #ff4444; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Logout</button>
    `;
    
    document.body.appendChild(userBar);
  }

  function logAccess(user) {
    const activity = {
      user: user.username,
      action: 'project_access',
      details: `Access to project: ${PROJECT_NAME}`,
      timestamp: new Date().toISOString()
    };
    
    const activities = JSON.parse(localStorage.getItem('yelo_activities') || '[]');
    activities.push(activity);
    
    if (activities.length > 100) {
      activities.splice(0, activities.length - 100);
    }
    
    localStorage.setItem('yelo_activities', JSON.stringify(activities));
  }

  window.yeloLogout = function() {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('yelo_auth');
      window.location.href = YELO_BASE_URL + 'login.html';
    }
  };

  // Check authentication when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
})();
