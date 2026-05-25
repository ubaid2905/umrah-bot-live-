// dashboard/frontend/app.js
const API_URL = '/api';

class Dashboard {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
    this.currentPage = 1;
    this.currentFilter = {};
    this.init();
  }

  init() {
    if (this.token) {
      this.showDashboard();
    } else {
      this.showLoginPage();
    }
  }

  showLoginPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h1>Umrah Bot Dashboard</h1>
          <div id="errorMsg" class="error-msg"></div>
          
          <form id="authForm">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" placeholder="your@email.com" required>
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" placeholder="••••••••" required>
            </div>
            
            <button type="submit" class="btn btn-primary" id="submitBtn">Login</button>
            <button type="button" class="btn btn-secondary" onclick="dashboard.toggleRegisterForm()">Sign Up</button>
          </form>
          
          <div id="registerForm" class="hidden">
            <h2 style="color: var(--primary-color); margin-top: 20px; margin-bottom: 15px;">Create Account</h2>
            <form id="registerFormElement">
              <div class="form-group">
                <label for="regUsername">Username</label>
                <input type="text" id="regUsername" placeholder="username" required>
              </div>
              
              <div class="form-group">
                <label for="regEmail">Email</label>
                <input type="email" id="regEmail" placeholder="your@email.com" required>
              </div>
              
              <div class="form-group">
                <label for="regPassword">Password</label>
                <input type="password" id="regPassword" placeholder="••••••••" required>
              </div>
              
              <div class="form-group">
                <label for="regPhone">WhatsApp Phone Number (Optional)</label>
                <input type="text" id="regPhone" placeholder="+1234567890">
              </div>
              
              <button type="submit" class="btn btn-primary">Sign Up</button>
              <button type="button" class="btn btn-secondary" onclick="dashboard.toggleRegisterForm()">Back to Login</button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('authForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerFormElement').addEventListener('submit', (e) => this.handleRegister(e));
  }

  toggleRegisterForm() {
    document.getElementById('registerForm').classList.toggle('hidden');
    document.getElementById('authForm').parentElement.parentElement.querySelector('form').classList.toggle('hidden');
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      this.token = data.token;
      this.user = data.user;
      this.showDashboard();
    } catch (err) {
      this.showError(err.message);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const phoneNumber = document.getElementById('regPhone').value;

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, phoneNumber: phoneNumber || undefined })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      this.token = data.token;
      this.user = data.user;
      this.showDashboard();
    } catch (err) {
      this.showError(err.message);
    }
  }

  showError(msg) {
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('show');
      setTimeout(() => errorMsg.classList.remove('show'), 5000);
    }
  }

  showDashboard() {
    const app = document.getElementById('app');
    const menuItems = this.user.role === 'admin' ? 
      `
        <li><a class="menu-item" onclick="dashboard.showPage('overview')">📊 Overview</a></li>
        <li><a class="menu-item" onclick="dashboard.showPage('all-activity')">📋 All Activity</a></li>
        <li><a class="menu-item" onclick="dashboard.showPage('users')">👥 Users</a></li>
      ` :
      `
        <li><a class="menu-item" onclick="dashboard.showPage('my-activity')">📋 My Activity</a></li>
        <li><a class="menu-item" onclick="dashboard.showPage('map-phone')">📱 Link WhatsApp</a></li>
      `;

    app.innerHTML = `
      <div class="dashboard">
        <aside class="sidebar">
          <div class="sidebar-logo">Umrah Bot</div>
          <ul class="sidebar-menu">
            ${menuItems}
            <li><a class="menu-item" onclick="dashboard.logout()">🚪 Logout</a></li>
          </ul>
        </aside>
        
        <main class="main-content">
          <div class="header">
            <div class="header-title">
              <h1 id="pageTitle">Dashboard</h1>
            </div>
            <div class="header-info">
              <div class="user-info">
                <strong>${this.user.username}</strong> (${this.user.role})
              </div>
              <button class="btn-logout" onclick="dashboard.logout()">Logout</button>
            </div>
          </div>
          
          <div id="content"></div>
        </main>
      </div>
    `;

    this.showPage('overview');
  }

  async showPage(page) {
    const content = document.getElementById('content');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    event?.target?.classList?.add('active');

    if (page === 'overview' && this.user.role === 'admin') {
      this.showOverview();
    } else if (page === 'all-activity' && this.user.role === 'admin') {
      this.showAllActivity();
    } else if (page === 'users' && this.user.role === 'admin') {
      this.showUsers();
    } else if (page === 'my-activity') {
      this.showMyActivity();
    } else if (page === 'map-phone') {
      this.showMapPhone();
    }
  }

  async showOverview() {
    document.getElementById('pageTitle').textContent = '📊 Overview';
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading stats...</div>';

    try {
      const response = await fetch(`${API_URL}/activity/stats/overview`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      content.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Interactions</div>
            <div class="stat-value">${data.totalInteractions}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Unique Users</div>
            <div class="stat-value">${data.uniqueUsers}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Today's Interactions</div>
            <div class="stat-value">${data.todayInteractions}</div>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<p style="color: red;">Error loading stats: ${err.message}</p>`;
    }
  }

  async showAllActivity(page = 1) {
    document.getElementById('pageTitle').textContent = '📋 All Activity';
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading activities...</div>';

    try {
      const params = new URLSearchParams({ page, limit: 50, ...this.currentFilter });
      const response = await fetch(`${API_URL}/activity/all?${params}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      let html = `
        <div class="content-card">
          <div class="card-title">User Activities</div>
          <div class="filters">
            <input type="text" id="filterPhone" placeholder="Filter by phone number" value="${this.currentFilter.phoneNumber || ''}">
            <button class="btn btn-primary" onclick="dashboard.applyFilters()">🔍 Filter</button>
          </div>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Phone Number</th>
                  <th>User Message</th>
                  <th>Bot Response</th>
                  <th>Timestamp</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
      `;

      data.activities.forEach(activity => {
        const timestamp = new Date(activity.timestamp).toLocaleString();
        const responseTime = activity.metadata.responseTime ? `${activity.metadata.responseTime}ms` : 'N/A';
        html += `
          <tr>
            <td>${activity.phoneNumber}</td>
            <td>${activity.userMessage.substring(0, 50)}...</td>
            <td>${activity.botResponse.substring(0, 50)}...</td>
            <td>${timestamp}</td>
            <td>${responseTime}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
      `;

      // Pagination
      if (data.pages > 1) {
        html += '<div class="pagination">';
        for (let i = 1; i <= data.pages; i++) {
          html += `<button onclick="dashboard.showAllActivity(${i})" ${i === page ? 'class="active"' : ''}>${i}</button>`;
        }
        html += '</div>';
      }

      html += '</div>';
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<p style="color: red;">Error loading activities: ${err.message}</p>`;
    }
  }

  async showMyActivity(page = 1) {
    document.getElementById('pageTitle').textContent = '📋 My Activity';
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading your activities...</div>';

    try {
      const response = await fetch(`${API_URL}/activity/my-activity?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      let html = `
        <div class="content-card">
          <div class="card-title">My Activities</div>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>User Message</th>
                  <th>Bot Response</th>
                  <th>Timestamp</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
      `;

      if (data.activities.length === 0) {
        html += '<tr><td colspan="4" style="text-align:center; color: var(--text-light);">No activities yet</td></tr>';
      } else {
        data.activities.forEach(activity => {
          const timestamp = new Date(activity.timestamp).toLocaleString();
          const responseTime = activity.metadata.responseTime ? `${activity.metadata.responseTime}ms` : 'N/A';
          html += `
            <tr>
              <td>${activity.userMessage.substring(0, 50)}...</td>
              <td>${activity.botResponse.substring(0, 50)}...</td>
              <td>${timestamp}</td>
              <td>${responseTime}</td>
            </tr>
          `;
        });
      }

      html += `
              </tbody>
            </table>
          </div>
      `;

      if (data.pages > 1) {
        html += '<div class="pagination">';
        for (let i = 1; i <= data.pages; i++) {
          html += `<button onclick="dashboard.showMyActivity(${i})" ${i === page ? 'class="active"' : ''}>${i}</button>`;
        }
        html += '</div>';
      }

      html += '</div>';
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<p style="color: red;">Error loading activities: ${err.message}</p>`;
    }
  }

  async showUsers() {
    document.getElementById('pageTitle').textContent = '👥 Users';
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading users...</div>';

    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      let html = `
        <div class="content-card">
          <div class="card-title">All Users</div>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Phone Number</th>
                  <th>Last Login</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
      `;

      data.users.forEach(user => {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';
        html += `
          <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-success'}">${user.role}</span></td>
            <td>${user.phoneNumber || '-'}</td>
            <td>${lastLogin}</td>
            <td><button class="btn" style="padding: 5px 10px; font-size: 12px;" onclick="dashboard.viewUserActivity('${user.phoneNumber}')">View</button></td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<p style="color: red;">Error loading users: ${err.message}</p>`;
    }
  }

  async showMapPhone() {
    document.getElementById('pageTitle').textContent = '📱 Link WhatsApp';
    const content = document.getElementById('content');

    content.innerHTML = `
      <div class="content-card">
        <div class="card-title">Link Your WhatsApp Number</div>
        <div style="max-width: 500px;">
          <div class="form-group">
            <label for="phoneToMap">WhatsApp Phone Number</label>
            <input type="text" id="phoneToMap" placeholder="+1234567890" required>
            <small style="color: var(--text-light); margin-top: 5px; display: block;">Include country code (e.g., +1, +44)</small>
          </div>
          <button class="btn btn-primary" onclick="dashboard.mapPhoneNumber()">Link Number</button>
          <div id="successMsg" class="success-msg"></div>
          <div id="errorMsgPhone" class="error-msg"></div>
        </div>

        <div style="margin-top: 30px;">
          <h3 style="color: var(--primary-color); margin-bottom: 15px;">Your Linked Numbers</h3>
          <div id="phoneList" style="color: var(--text-light);">Loading...</div>
        </div>
      </div>
    `;

    this.loadLinkedPhones();
  }

  async loadLinkedPhones() {
    try {
      const response = await fetch(`${API_URL}/users/my-phones`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      const phoneList = document.getElementById('phoneList');

      if (data.phoneNumbers.length === 0) {
        phoneList.innerHTML = '<p>No phone numbers linked yet.</p>';
      } else {
        let html = '<ul style="list-style: none;">';
        data.phoneNumbers.forEach(phone => {
          html += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">✓ ${phone}</li>`;
        });
        html += '</ul>';
        phoneList.innerHTML = html;
      }
    } catch (err) {
      document.getElementById('phoneList').innerHTML = `<p style="color: red;">Error loading phones: ${err.message}</p>`;
    }
  }

  async mapPhoneNumber() {
    const phone = document.getElementById('phoneToMap').value;

    if (!phone) {
      this.showPhoneError('Please enter a phone number');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/map-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ phoneNumber: phone })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      this.showPhoneSuccess('Phone number linked successfully!');
      document.getElementById('phoneToMap').value = '';
      setTimeout(() => this.loadLinkedPhones(), 500);
    } catch (err) {
      this.showPhoneError(err.message);
    }
  }

  async viewUserActivity(phoneNumber) {
    document.getElementById('pageTitle').textContent = `📋 Activity - ${phoneNumber}`;
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading user activity...</div>';

    try {
      const response = await fetch(`${API_URL}/activity/user/${phoneNumber}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      let html = `
        <div class="content-card">
          <div class="card-title">Activity for ${phoneNumber}</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Messages</div>
              <div class="stat-value">${data.stats.totalMessages}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Response Time</div>
              <div class="stat-value">${Math.round(data.stats.avgResponseTime)}ms</div>
            </div>
          </div>

          <div class="table-responsive" style="margin-top: 20px;">
            <table>
              <thead>
                <tr>
                  <th>User Message</th>
                  <th>Bot Response</th>
                  <th>Timestamp</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
      `;

      data.activities.forEach(activity => {
        const timestamp = new Date(activity.timestamp).toLocaleString();
        const responseTime = activity.metadata.responseTime ? `${activity.metadata.responseTime}ms` : 'N/A';
        html += `
          <tr>
            <td>${activity.userMessage.substring(0, 50)}...</td>
            <td>${activity.botResponse.substring(0, 50)}...</td>
            <td>${timestamp}</td>
            <td>${responseTime}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<p style="color: red;">Error loading activity: ${err.message}</p>`;
    }
  }

  applyFilters() {
    const phoneNumber = document.getElementById('filterPhone').value;
    this.currentFilter = { phoneNumber: phoneNumber || undefined };
    this.showAllActivity(1);
  }

  showPhoneError(msg) {
    const errorMsg = document.getElementById('errorMsgPhone');
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('show');
      setTimeout(() => errorMsg.classList.remove('show'), 5000);
    }
  }

  showPhoneSuccess(msg) {
    const successMsg = document.getElementById('successMsg');
    if (successMsg) {
      successMsg.textContent = msg;
      successMsg.classList.add('show');
      setTimeout(() => successMsg.classList.remove('show'), 5000);
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.token = null;
    this.user = {};
    this.init();
  }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new Dashboard();
});
