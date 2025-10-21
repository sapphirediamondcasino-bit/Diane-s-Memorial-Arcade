// ==========================================
// Frontend JavaScript - app.js
// ==========================================

class DianeArcade {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadLeaderboard();
    }

    // Check if user is authenticated
    async checkAuth() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                this.currentUser = await response.json();
                this.updateUI();
            } else {
                this.currentUser = null;
                this.showLoginPrompt();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }

    // Update UI based on login state
    updateUI() {
        const userProfileHTML = document.getElementById('user-profile-section');
        const loginBtnHTML = document.getElementById('login-button-section');

        if (this.currentUser) {
            // User is logged in
            loginBtnHTML.style.display = 'none';
            userProfileHTML.style.display = 'flex';
            userProfileHTML.innerHTML = `
                <div class="user-profile" onclick="arcade.showProfile()">
                    <img src="${this.currentUser.avatar_url || 'https://via.placeholder.com/30'}" class="user-avatar" alt="Avatar">
                    <div>
                        <div class="user-name">${this.currentUser.username}</div>
                        <div class="user-level">LVL ${this.currentUser.level} ${this.currentUser.prestige > 0 ? `P${this.currentUser.prestige}` : ''}</div>
                    </div>
                </div>
            `;
        } else {
            // User is not logged in
            userProfileHTML.style.display = 'none';
            loginBtnHTML.style.display = 'block';
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Login button
        const loginBtn = document.getElementById('show-login-modal');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }

        // Close modal
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    // Show login modal
    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Show login prompt for non-logged users
    showLoginPrompt() {
        // Show message that some features require login
        const gamesNeedLogin = document.querySelectorAll('[data-requires-login]');
        gamesNeedLogin.forEach(game => {
            game.addEventListener('click', (e) => {
                if (!this.currentUser) {
                    e.preventDefault();
                    this.showLoginModal();
                    this.showNotification('Please login to play games and earn achievements!', 'info');
                }
            });
        });
    }

    // Close modal
    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.classList.remove('active'));
    }

    // Handle registration
    async handleRegister(e) {
        e.preventDefault();
        
        const form = e.target;
        const email = form.querySelector('[name="email"]').value;
        const username = form.querySelector('[name="username"]').value;
        const password = form.querySelector('[name="password"]').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Registration successful! Please login.', 'success');
                this.switchToLogin();
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Server error. Please try again.', 'error');
        }
    }

    // Handle login
    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const email = form.querySelector('[name="email"]').value;
        const password = form.querySelector('[name="password"]').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.updateUI();
                this.closeModal();
                this.showNotification('Welcome back, ' + data.user.username + '!', 'success');
                this.loadLeaderboard();
            } else {
                this.showNotification('Invalid email or password', 'error');
            }
        } catch (error) {
            this.showNotification('Server error. Please try again.', 'error');
        }
    }

    // Google Login
    loginWithGoogle() {
        window.location.href = '/auth/google';
    }

    // Logout
    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.updateUI();
            this.showNotification('Logged out successfully', 'success');
            window.location.reload();
        } catch (error) {
            this.showNotification('Logout failed', 'error');
        }
    }

    // Switch between login and register forms
    switchToLogin() {
        document.getElementById('register-form-container').style.display = 'none';
        document.getElementById('login-form-container').style.display = 'block';
    }

    switchToRegister() {
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('register-form-container').style.display = 'block';
    }

    // Save game score
    async saveGameScore(gameName, score) {
        if (!this.currentUser) {
            this.showNotification('Login to save your score!', 'info');
            return;
        }

        try {
            const response = await fetch('/api/game/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_name: gameName, score })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Score saved! +' + score + ' XP', 'success');
                await this.checkAuth(); // Refresh user data
            } else {
                this.showNotification('Failed to save score', 'error');
            }
        } catch (error) {
            console.error('Save score error:', error);
        }
    }

    // Load leaderboard
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const leaderboard = await response.json();

            const leaderboardContainer = document.getElementById('leaderboard-list');
            if (!leaderboardContainer) return;

            leaderboardContainer.innerHTML = leaderboard.map((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
                const prestigeIcon = user.prestige > 0 ? this.getPrestigeIcon(user.prestige) : '';
                
                return `
                    <div class="leaderboard-item">
                        <div class="rank">${medal}</div>
                        <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" class="lb-avatar" alt="${user.username}">
                        <div class="lb-info">
                            <div class="lb-name">${user.username} ${prestigeIcon}</div>
                            <div class="lb-stats">Level ${user.level} • ${user.total_score || 0} pts • ${user.games_played || 0} games</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    // Load user achievements
    async loadAchievements() {
        if (!this.currentUser) return;

        try {
            const response = await fetch('/api/user/achievements');
            const achievements = await response.json();

            const achievementsContainer = document.getElementById('achievements-list');
            if (!achievementsContainer) return;

            achievementsContainer.innerHTML = achievements.map(achievement => {
                const unlocked = achievement.unlocked_at !== null;
                return `
                    <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <div class="achievement-name">${achievement.name}</div>
                        <div class="achievement-desc">${achievement.description}</div>
                        <div class="achievement-xp">+${achievement.xp_reward} XP</div>
                        ${unlocked ? `<div class="unlock-date">Unlocked ${new Date(achievement.unlocked_at).toLocaleDateString()}</div>` : ''}
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load achievements:', error);
        }
    }

    // Show user profile modal
    async showProfile() {
        if (!this.currentUser) return;

        // Load full profile data
        try {
            const response = await fetch(`/api/user/profile/${this.currentUser.id}`);
            const profile = await response.json();

            const profileModal = document.getElementById('profile-modal');
            if (!profileModal) return;

            document.getElementById('profile-content').innerHTML = `
                <img src="${profile.avatar_url || 'https://via.placeholder.com/150'}" class="profile-avatar" alt="${profile.username}">
                <h2>${profile.username}</h2>
                <div class="profile-stats">
                    <div class="profile-stat">
                        <span class="stat-label">Level</span>
                        <span class="stat-value">${profile.level}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-label">Prestige</span>
                        <span class="stat-value">${profile.prestige}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-label">XP</span>
                        <span class="stat-value">${profile.xp}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-label">Games Played</span>
                        <span class="stat-value">${profile.total_games}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-label">Achievements</span>
                        <span class="stat-value">${profile.achievements_unlocked}</span>
                    </div>
                    <div class="profile-stat">
                        <span class="stat-label">Highest Score</span>
                        <span class="stat-value">${profile.highest_score || 0}</span>
                    </div>
                </div>
                <button onclick="arcade.loadAchievements(); document.getElementById('achievements-modal').classList.add('active');" class="btn">View Achievements</button>
                <button onclick="arcade.logout()" class="btn btn-logout">Logout</button>
            `;

            profileModal.classList.add('active');
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }

    // Get prestige icon
    getPrestigeIcon(prestige) {
        const icons = ['', '⭐', '🌟', '✨', '💫', '🔥', '⚡', '💎', '👑', '🏆', '🌌'];
        return icons[prestige] || `P${prestige}`;
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize arcade when page loads
let arcade;
document.addEventListener('DOMContentLoaded', () => {
    arcade = new DianeArcade();
});
