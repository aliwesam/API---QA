const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// JWT Configuration
const JWT_SECRET = 'super-secret-key-123'; // Bug: Weak secret in code
const JWT_EXPIRY = '24h';

// Middleware
app.use(express.json());

// Buggy JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // Bug: No proper error handling for JWT verification
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
}

// Bug: Inconsistent auth middleware - sometimes checks, sometimes doesn't
function maybeAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    // Bug: Authentication bypass if header exists but is empty
    if (authHeader && authHeader.length > 0) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Bug: Silently fails authentication, continues anyway
            console.log('Auth failed, but continuing...', error.message);
        }
    }
    next();
}

// In-memory data store (simulating a database)
let users = [
    { id: 1, name: "John Doe", email: "john@example.com", age: 30, role: "admin" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", age: 25, role: "user" },
    { id: 3, name: "Bob Wilson", email: "bob@example.com", age: 35, role: "user" }
];

let products = [
    { id: 1, name: "Laptop", price: 999.99, category: "Electronics", stock: 10 },
    { id: 2, name: "Book", price: 19.99, category: "Education", stock: 50 },
    { id: 3, name: "Coffee Mug", price: 12.50, category: "Home", stock: 0 }
];

// AUTH ENDPOINTS

// Login endpoint (generates JWT)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Bug: Hardcoded credentials and weak validation
    const validUsers = {
        'admin': 'admin123',
        'user': 'user123',
        'test': 'test', // Bug: Very weak password
        '': 'empty' // Bug: Allows empty username
    };
    
    // Bug: Case sensitive comparison only
    if (validUsers[username] === password) {
        const token = jwt.sign(
            { 
                username, 
                role: username === 'admin' ? 'admin' : 'user',
                // Bug: Exposing sensitive info in token
                internalId: 'internal_' + Math.random(),
                secret: 'should-not-be-here'
            }, 
            JWT_SECRET, 
            { expiresIn: JWT_EXPIRY }
        );
        
        res.json({ 
            token, 
            user: { username, role: username === 'admin' ? 'admin' : 'user' },
            // Bug: Exposing JWT secret in response
            debug: { secret: JWT_SECRET, algorithm: 'HS256' }
        });
    } else {
        // Bug: Different response format for invalid credentials
        res.status(401).send('Invalid credentials');
    }
});

// Bug: No logout endpoint (tokens remain valid until expiry)

// SIMPLE BUGS (Enhanced with auth issues)

// Bug 1: Inconsistent HTTP status codes + Auth bypass
app.get('/api/users', maybeAuthenticateToken, (req, res) => {
    // Bug: Should return 200, but returns 201 (Created) instead
    // Bug: Uses weak auth that can be bypassed
    res.status(201).json({ 
        users, 
        total: users.length,
        // Bug: Exposing whether user is authenticated
        authenticated: !!req.user
    });
});

// Bug 2: Missing input validation + Empty handling
app.post('/api/users', authenticateToken, (req, res) => {
    const { name, email, age, role } = req.body;
    
    // Bug: Handles empty body but creates invalid users
    const newUser = {
        id: users.length + 1,
        name: name || 'Unknown User', // Bug: Accepts empty/undefined
        email: email || 'no-email@example.com', // Bug: Creates invalid email
        age: age || 0, // Bug: Age can be 0 or negative
        role: role || 'user'
    };
    
    // Bug: No validation for email format, age limits, role validity
    users.push(newUser);
    
    // Bug: Returns sensitive user info including internal fields
    res.status(201).json({
        user: newUser,
        createdBy: req.user.username,
        internalToken: req.user.internalId
    });
});

// Bug 3: Inconsistent response format + Search issues
app.get('/api/users/:id', maybeAuthenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Bug: String to number conversion issues
    if (req.params.id === 'undefined' || req.params.id === 'null') {
        // Bug: Unhandled exception for invalid IDs
        throw new Error('Invalid user ID provided');
    }
    
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        // Bug: Different error format than other endpoints
        return res.status(404).send("User not found");
    }
    
    // Bug: Returns user directly instead of wrapped in object like other endpoints
    res.json(user);
});

// MEDIUM BUGS (Enhanced with auth and search issues)

// Bug 4: Race condition and incorrect ID generation + Auth issues
app.post('/api/products', maybeAuthenticateToken, (req, res) => {
    const { name, price, category, stock } = req.body || {}; // Bug: Handles empty body
    
    // Bug: Using array length for ID can cause duplicates in concurrent requests
    const newProduct = {
        id: products.length + 1, // Should use proper ID generation
        name: name || 'Unnamed Product', // Bug: Accepts empty name
        price: parseFloat(price) || 0, // Bug: Price can be 0, NaN becomes 0
        category: category || 'Uncategorized',
        stock: parseInt(stock) || 0 // Bug: Stock can be 0 or negative
    };
    
    // Bug: No validation for negative prices or stock
    products.push(newProduct);
    
    // Bug: Different response based on authentication
    if (req.user) {
        res.status(201).json({ 
            product: newProduct, 
            createdBy: req.user.username,
            adminAccess: req.user.role === 'admin'
        });
    } else {
        res.status(201).json({ product: newProduct });
    }
});

// Bug 5: Pagination logic error + Inexact search
app.get('/api/products', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    
    let filteredProducts = [...products];
    
    // Bug: Inexact search implementation with issues
    if (search) {
        filteredProducts = products.filter(p => {
            // Bug: Case sensitive search only
            // Bug: Doesn't handle null/undefined properly
            return p.name.indexOf(search) !== -1 || 
                   p.category.indexOf(search) !== -1;
        });
    }
    
    // Bug: Incorrect offset calculation
    const offset = (page - 1) * limit + 1; // Should be: (page - 1) * limit
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);
    
    res.json({
        products: paginatedProducts,
        page,
        limit,
        search: search || null,
        total: filteredProducts.length,
        // Bug: Incorrect total pages calculation
        totalPages: Math.floor(filteredProducts.length / limit), // Should use Math.ceil
        // Bug: Exposing internal search logic
        searchMethod: 'indexOf',
        appliedFilters: { search }
    });
});

// Bug 6: Authentication bypass + Role confusion
app.delete('/api/users/:id', maybeAuthenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);
    
    // Bug: Weak authentication check
    if (!req.user || !req.user.username) {
        // Bug: Still allows deletion with partial auth
        console.log('Warning: Unauthenticated deletion attempt');
    }
    
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
    }
    
    const deletedUser = users[userIndex];
    
    // Bug: Admin users can delete themselves
    // Bug: Users can delete other users if they have any token
    users.splice(userIndex, 1);
    
    res.json({ 
        message: "User deleted successfully", 
        user: deletedUser,
        deletedBy: req.user ? req.user.username : 'unknown'
    });
});

// HARD BUGS

// Bug 7: SQL Injection simulation (even though we're not using SQL)
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    // Bug: Unsafe string interpolation that could be exploited
    // Simulating SQL injection vulnerability
    let results = [];
    
    if (query.includes("'") || query.includes(";") || query.includes("--")) {
        // Simulate SQL injection attack detection
        results = users.concat(products); // Returns all data
    } else {
        results = users.filter(u => 
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    res.json({ results, query });
});

// Bug 8: DESTRUCTIVE - Memory exhaustion and infinite loops
app.get('/api/analytics', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    let analytics = [];
    
    // DESTRUCTIVE BUG: Will crash the server with high memory usage
    if (days > 100) {
        // Create massive arrays to exhaust memory
        for (let x = 0; x < days; x++) {
            const massiveArray = new Array(100000).fill().map(() => ({
                id: Math.random(),
                data: new Array(1000).fill('x'.repeat(1000)),
                timestamp: new Date().toISOString(),
                nestedData: new Array(500).fill({ value: Math.random() })
            }));
            analytics.push(...massiveArray);
        }
    }
    
    // DESTRUCTIVE BUG: Infinite loop that will hang the server
    if (req.query.crash === 'true') {
        while (true) {
            analytics.push(new Array(10000).fill(Math.random()));
        }
    }
    
    // DESTRUCTIVE BUG: Exponential complexity
    if (req.query.exponential === 'true') {
        function exponentialFunction(n) {
            if (n <= 1) return 1;
            return exponentialFunction(n-1) + exponentialFunction(n-1);
        }
        const result = exponentialFunction(days > 35 ? 35 : days);
        analytics.push(result);
    }
    
    res.json({ analytics: analytics.slice(0, 100) }); // Return limited data but keep all in memory
});

// Bug 9: Inconsistent error handling and information disclosure
app.put('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        // Bug: Exposing internal system information
        return res.status(404).json({ 
            error: "User not found",
            debug: {
                searchedId: userId,
                availableIds: users.map(u => u.id),
                serverTime: new Date().toISOString(),
                nodeVersion: process.version
            }
        });
    }
    
    const { name, email, age, role } = req.body;
    
    // Bug: Partial update without proper validation
    if (name !== undefined) users[userIndex].name = name;
    if (email !== undefined) users[userIndex].email = email;
    if (age !== undefined) users[userIndex].age = age; // No type checking
    if (role !== undefined) users[userIndex].role = role; // No role validation
    
    res.json({ user: users[userIndex] });
});

// Bug 10: CORS and security headers missing
app.get('/api/admin/sensitive-data', (req, res) => {
    // Bug: No CORS policy
    // Bug: No authentication required for sensitive endpoint
    // Bug: Exposing sensitive information
    const sensitiveData = {
        apiKeys: ["sk-12345", "sk-67890"],
        databaseUrl: "mongodb://admin:password123@localhost:27017/testdb",
        users: users,
        serverConfig: {
            environment: process.env.NODE_ENV || "development",
            port: PORT,
            memory: process.memoryUsage()
        }
    };
    
    res.json(sensitiveData);
});

// Bug 11: Rate limiting bypass
let requestCounts = {};
app.get('/api/limited-endpoint', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Bug: Rate limiting logic can be bypassed with different headers
    const identifier = req.headers['x-forwarded-for'] || clientIP;
    
    if (!requestCounts[identifier]) {
        requestCounts[identifier] = { count: 0, resetTime: Date.now() + 60000 };
    }
    
    // Bug: Reset time logic is flawed
    if (Date.now() > requestCounts[identifier].resetTime) {
        requestCounts[identifier].count = 0;
        requestCounts[identifier].resetTime = Date.now() + 60000;
    }
    
    requestCounts[identifier].count++;
    
    // Bug: Rate limit can be bypassed by changing user agent
    if (requestCounts[identifier].count > 10 && !req.headers['user-agent'].includes('TestBot')) {
        return res.status(429).json({ error: "Rate limit exceeded" });
    }
    
    res.json({ message: "Success", requestCount: requestCounts[identifier].count });
});

// Error handling middleware (with JWT and exception bugs)
app.use((error, req, res, next) => {
    // Bug: Exposing stack traces and sensitive info in production
    const errorResponse = {
        error: "Internal Server Error",
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        // Bug: Exposing request details
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        requestHeaders: req.headers,
        // Bug: Exposing JWT secret if available
        jwtSecret: JWT_SECRET,
        nodeEnv: process.env.NODE_ENV || 'development'
    };
    
    // Bug: Different error handling based on auth
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            errorResponse.userContext = decoded;
        } catch (jwtError) {
            errorResponse.authError = jwtError.message;
        }
    }
    
    res.status(500).json(errorResponse);
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: "Endpoint not found", path: req.originalUrl });
});

app.listen(PORT, () => {
    console.log(`Buggy Test API with JWT Auth running on port ${PORT}`);
    console.log(`\n=== AUTH ENDPOINTS ===`);
    console.log(`POST   /api/auth/login`);
    console.log(`\n=== TEST ENDPOINTS ===`);
    console.log(`GET    /api/users (weak auth)`);
    console.log(`POST   /api/users (requires auth)`);
    console.log(`GET    /api/users/:id (weak auth)`);
    console.log(`PUT    /api/users/:id (requires auth)`);
    console.log(`DELETE /api/users/:id (weak auth)`);
    console.log(`GET    /api/products (no auth)`);
    console.log(`POST   /api/products (weak auth)`);
    console.log(`GET    /api/search?q=term (weak auth)`);
    console.log(`GET    /api/analytics?days=30 (requires auth)`);
    console.log(`GET    /api/admin/sensitive-data (no auth - BUG!)`);
    console.log(`GET    /api/limited-endpoint (no auth)`);
    console.log(`\n=== TEST CREDENTIALS ===`);
    console.log(`Admin: username=admin, password=admin123`);
    console.log(`User:  username=user, password=user123`);
    console.log(`Test:  username=test, password=test`);
    console.log(`Empty: username="", password=empty`);
    console.log(`\n⚠️  WARNING: This API contains dangerous bugs for testing!`);
});

module.exports = app;