const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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

// SIMPLE BUGS

// Bug 1: Inconsistent HTTP status codes
app.get('/api/users', (req, res) => {
    // Should return 200, but returns 201 (Created) instead
    res.status(201).json({ users, total: users.length });
});

// Bug 2: Missing input validation
app.post('/api/users', (req, res) => {
    const { name, email, age, role } = req.body;
    
    // Bug: No validation for required fields or data types
    const newUser = {
        id: users.length + 1,
        name,
        email,
        age,
        role: role || "user"
    };
    
    users.push(newUser);
    res.status(201).json(newUser);
});

// Bug 3: Inconsistent response format
app.get('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        // Bug: Different error format than other endpoints
        return res.status(404).send("User not found");
    }
    
    // Bug: Returns user directly instead of wrapped in object like other endpoints
    res.json(user);
});

// MEDIUM BUGS

// Bug 4: Race condition and incorrect ID generation
app.post('/api/products', (req, res) => {
    const { name, price, category, stock } = req.body;
    
    // Bug: Using array length for ID can cause duplicates in concurrent requests
    const newProduct = {
        id: products.length + 1, // Should use proper ID generation
        name,
        price: parseFloat(price),
        category,
        stock: parseInt(stock)
    };
    
    // Bug: No validation for negative prices or stock
    products.push(newProduct);
    res.status(201).json({ product: newProduct });
});

// Bug 5: Pagination logic error
app.get('/api/products', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Bug: Incorrect offset calculation
    const offset = (page - 1) * limit + 1; // Should be: (page - 1) * limit
    const paginatedProducts = products.slice(offset, offset + limit);
    
    res.json({
        products: paginatedProducts,
        page,
        limit,
        total: products.length,
        // Bug: Incorrect total pages calculation
        totalPages: Math.floor(products.length / limit) // Should use Math.ceil
    });
});

// Bug 6: Authentication bypass
app.delete('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);
    
    // Bug: Missing authentication check
    // Bug: Admin users can delete themselves
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
    }
    
    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    
    res.json({ message: "User deleted successfully", user: deletedUser });
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

// Bug 8: Memory leak and performance issue
app.get('/api/analytics', (req, res) => {
    // Bug: Creating large arrays that aren't cleaned up
    let analytics = [];
    
    // Bug: Infinite loop condition under certain circumstances
    for (let i = 0; i < (req.query.days || 30); i++) {
        if (req.query.days > 1000) {
            // This will run for a very long time
            i = 0; // Reset counter, causing infinite loop
        }
        
        analytics.push({
            day: i,
            users: Math.floor(Math.random() * 1000),
            sales: Math.floor(Math.random() * 5000),
            timestamp: new Date().toISOString()
        });
    }
    
    // Bug: Not handling memory efficiently
    const heavyData = new Array(10000).fill(analytics);
    
    res.json({ analytics: heavyData[0] }); // Only return first array but keep all in memory
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

// Error handling middleware (with bugs)
app.use((error, req, res, next) => {
    // Bug: Exposing stack traces in production
    res.status(500).json({
        error: "Internal Server Error",
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: "Endpoint not found", path: req.originalUrl });
});

app.listen(PORT, () => {
    console.log(`Buggy Test API running on port ${PORT}`);
    console.log(`Test endpoints:`);
    console.log(`GET    /api/users`);
    console.log(`POST   /api/users`);
    console.log(`GET    /api/users/:id`);
    console.log(`PUT    /api/users/:id`);
    console.log(`DELETE /api/users/:id`);
    console.log(`GET    /api/products`);
    console.log(`POST   /api/products`);
    console.log(`GET    /api/search?q=term`);
    console.log(`GET    /api/analytics?days=30`);
    console.log(`GET    /api/admin/sensitive-data`);
    console.log(`GET    /api/limited-endpoint`);
});

module.exports = app;
