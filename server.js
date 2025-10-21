// ==========================================
// Diane's Arcade - Backend Server
// Internal Data Store (JSON files)
// ==========================================

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE SETUP
// ==========================================

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'diane-arcade-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ==========================================
// DATA STORAGE - LOCAL JSON FILES
// ==========================================

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, 'achievements.json');

// Ensure data directory exists
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// Load data from JSON files
function loadUsers() {
    ensureDataDir();
    if (fs.existsSync(USERS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading users:', e);
            return {};
        }
    }
    return {};
}

function loadScores() {
    ensureDataDir();
    if (fs.existsSync(SCORES_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading scores:', e);
            return [];
        }
    }
    return [];
}

function loadAchievements() {
    ensureDataDir();
    if (fs.existsSync(ACHIEVEMENTS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading achievements:', e);
            return [];
        }
    }
    return [];
}

// Save data to JSON files
function saveUsers(users) {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveScores(scores) {
    ensureDataDir();
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

function saveAchievements(achievements) {
    ensureDataDir();
    fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }

        const users = loadUsers();

        // Check if user exists
        if (Object.values(users).some(u => u.email === email || u.username === username)) {
            return res.status(400).json({ error: 'Email or username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const userId = Date.now().toString();
        const newUser = {
            id: userId,
            email,
            username,
            password: hashedPassword,
            level: 1,
            xp: 0,
            total_score: 0,
            total_games_played: 0,
            highest_score: 0,
            avatar_url: `https://via.placeholder.com/30?text=${username.charAt(0).toUpperCase()}`,
            created_at: new Date().toISOString()
        };

        users[userId] = newUser;
        saveUsers(users);

        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const users = loadUsers();
        const user = Object.values(users).find(u => u.email === email);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = user.id;

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check auth status
app.get('/api/user', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const users = loadUsers();
    const user = users[req.session.userId];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

// ==========================================
// GAME ROUTES
// ==========================================

// Save game score
app.post('/api/game/score', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { game_name, score } = req.body;
        const users = loadUsers();
        const user = users[req.session.userId];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user stats
        user.total_score = (user.total_score || 0) + score;
        user.total_games_played = (user.total_games_played || 0) + 1;
        user.highest_score = Math.max(user.highest_score || 0, score);

        // Calculate level based on XP
        const xpGain = Math.floor(score / 10);
        user.xp = (user.xp || 0) + xpGain;
        user.level = Math.floor(user.xp / 100) + 1;

        saveUsers(users);

        // Save score record
        const scores = loadScores();
        scores.push({
            userId: req.session.userId,
            username: user.username,
            game_name,
            score,
            timestamp: new Date().toISOString()
        });
        saveScores(scores);

        res.json({ success: true, message: 'Score saved', xp_gained: xpGain });
    } catch (error) {
        console.error('Score save error:', error);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

// ==========================================
// LEADERBOARD ROUTES
// ==========================================

app.get('/api/leaderboard', (req, res) => {
    try {
        const users = loadUsers();
        const leaderboard = Object.values(users)
            .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
            .slice(0, 50)
            .map(user => ({
                id: user.id,
                username: user.username,
                level: user.level,
                total_score: user.total_score,
                total_games_played: user.total_games_played,
                avatar_url: user.avatar_url
            }));

        res.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// ==========================================
// USER PROFILE ROUTES
// ==========================================

app.get('/api/user/profile/:userId', (req, res) => {
    try {
        const users = loadUsers();
        const user = users[req.params.userId];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user achievements
        const achievements = loadAchievements();
        const userAchievements = achievements.filter(a => a.userId === req.params.userId);

        const { password: _, ...profile } = user;
        profile.achievements_unlocked = userAchievements.length;

        res.json(profile);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

// ==========================================
// ACHIEVEMENTS ROUTES
// ==========================================

app.get('/api/user/achievements', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const achievements = loadAchievements();
        const userAchievements = achievements.filter(a => a.userId === req.session.userId);

        // Return all achievements with unlock status
        const allAchievements = [
            { id: 1, name: 'First Score', description: 'Save your first game score', icon: '🎮', xp_reward: 50 },
            { id: 2, name: 'Century', description: 'Reach 100 points in a single game', icon: '💯', xp_reward: 100 },
            { id: 3, name: 'High Roller', description: 'Reach 500 total points', icon: '🎰', xp_reward: 200 },
            { id: 4, name: 'Arcade Master', description: 'Reach level 10', icon: '👑', xp_reward: 500 },
            { id: 5, name: 'Persistence', description: 'Play 50 games', icon: '💪', xp_reward: 300 }
        ];

        const achievementsWithStatus = allAchievements.map(ach => {
            const unlocked = userAchievements.find(ua => ua.achievementId === ach.id);
            return {
                ...ach,
                unlocked_at: unlocked ? unlocked.unlockedAt : null
            };
        });

        res.json(achievementsWithStatus);
    } catch (error) {
        console.error('Achievements error:', error);
        res.status(500).json({ error: 'Failed to load achievements' });
    }
});

// ==========================================
// ERROR HANDLING & SERVER START
// ==========================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Diane's Arcade server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    ensureDataDir();
});
