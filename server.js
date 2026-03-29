const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());


const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));


const db = new sqlite3.Database("expenses.db", err => {
    if(err) console.log("DB Error:", err.message);
    else console.log("Connected to SQLite database ✅");
});


db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    description TEXT,
    amount REAL,
    type TEXT,
    category TEXT,
    date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL
)`);


app.get("/", (req,res)=>{
    res.sendFile(path.join(frontendPath,"login.html"));
});


app.post("/register", (req,res)=>{
    const {username,password} = req.body;
    db.run("INSERT INTO users(username,password) VALUES(?,?)", [username,password], function(err){
        if(err) return res.json({success:false,message:"User exists"});
        res.json({success:true,userId:this.lastID});
    });
});

app.post("/login", (req,res)=>{
    const {username,password} = req.body;
    db.get("SELECT * FROM users WHERE username=? AND password=?", [username,password], (err,row)=>{
        if(err) return res.status(500).json({success:false,message:err.message});
        if(row) res.json({success:true,userId:row.id});
        else res.json({success:false});
    });
});


app.get("/transactions/:userId", (req,res)=>{
    const userId = req.params.userId;
    db.all("SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, id DESC", [userId], (err, rows)=>{
        if(err) return res.status(500).json({success:false,message:err.message});
        res.json(rows);
    });
});


app.post("/transactions", (req,res)=>{
    const {userId,description,amount,type,category,date} = req.body;
    db.run("INSERT INTO transactions(user_id,description,amount,type,category,date) VALUES(?,?,?,?,?,?)",
        [userId,description,amount,type,category,date],
        function(err){
            if(err) return res.status(500).json({success:false,message:err.message});
            res.json({success:true, id:this.lastID});
        }
    );
});

app.delete("/transactions/:id", (req,res)=>{
    db.run("DELETE FROM transactions WHERE id=?", [req.params.id], function(err){
        if(err) return res.status(500).json({success:false,message:err.message});
        res.json({success:true});
    });
});


app.post("/budget", (req,res)=>{
    const {userId,amount} = req.body;
    db.run("DELETE FROM budgets WHERE user_id=?", [userId], (err)=>{
        if(err) return res.status(500).json({success:false,message:err.message});
        db.run("INSERT INTO budgets(user_id,amount) VALUES(?,?)", [userId,amount], (err)=>{
            if(err) return res.status(500).json({success:false,message:err.message});
            res.json({success:true});
        });
    });
});


app.get("/budget/:userId", (req,res)=>{
    db.get("SELECT * FROM budgets WHERE user_id=?", [req.params.userId], (err,row)=>{
        if(err) return res.status(500).send(err.message);
        res.json(row || {amount:0});
    });
});


app.get("/summary/:userId", (req,res)=>{
    const userId = req.params.userId;
    const month = req.query.month;

    let sql = `
        SELECT 
            IFNULL(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS totalIncome,
            IFNULL(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS totalExpense
        FROM transactions
        WHERE user_id=?
    `;

    let params = [userId];

    if(month){
        sql += " AND strftime('%Y-%m', date)=?";
        params.push(month);
    }

    db.get(sql, params, (err,row)=>{
        if(err) return res.status(500).send(err.message);

        row.netSavings = row.totalIncome - row.totalExpense;

        res.json(row);
        console.log("Received month:", req.query.month);
    });
});

const PORT = 5000;
app.listen(PORT, ()=>console.log(`Server running at http://localhost:${PORT} 🚀`));