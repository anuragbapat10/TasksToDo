// jshint esversion: 6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.use(express.static(__dirname + "/public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

// setting up sessions
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

// initializing passport
app.use(passport.initialize());
app.use(passport.session());

// setting up MongoDB using Mongoose
mongoose.connect("mongodb://localhost:27017/todoDB");

const taskSchema = new mongoose.Schema ({
    title: String,
    description: String,
    deadline: {
        day: String,
        month: String,
        year: String
    }
});

const userSchema = new mongoose.Schema ({
    username: String,
    password: String,
    // googleId: String,
    // secret: String,
    tasks: [taskSchema]
});

userSchema.plugin(passportLocalMongoose);

const Task = mongoose.model("Task", taskSchema);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// GETTING DATE
const today = new Date();
const options = {
    weekday: "long"
}

listItems = [];

app.get("/", function(req, res) {
    res.render("home");
});

let duplicateUser = false;
let userPresent = true;

app.get("/list", function(req, res) {
    if (req.isAuthenticated()) {
        User.findOne({username: req.user.username}, function(err, foundUser) {
            if (err) console.log(err);
            else {
                if (foundUser) {                    
                    res.render("list", {
                        date: today.toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        }),
                        listItems: foundUser.tasks,
                        username: req.user.username
                    });
                }
            }
        });
    } else {
        res.redirect("/login");
    }
});


app.get("/login", function(req, res) {
    res.render("login");
});
app.post("/login", function(req, res) {
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });

    User.findOne({username: user.username}, function(err, foundUser) {
        if (err) console.log(err);
        else if (!foundUser) {
            userPresent = false;
            res.redirect("/register");
        } else {
            userPresent = true;
            req.login(user, function(err) {
                if (err) {
                    res.redirect("/register");
                    console.log(err);
                }
                else {
                    passport.authenticate("local")(req, res, function() {
                        res.redirect("/list");
                    });
                }
            });
        }
    });
});


app.get("/register", function(req, res) {
    res.render("register", { duplicateUser: duplicateUser, userPresent: userPresent });
    userPresent = true;
    duplicateUser = false;
});
app.post("/register", function(req, res) {
    User.findOne({username: req.body.username}, function(err, foundUser) {
        if (err) return err;
        else if (foundUser) {
                duplicateUser = true;
                // res.statusCode = 409;
                // return res.send({"message": "Username is already taken. Enter different username."})
                res.redirect("/register");
        } else {
            duplicateUser = false;
            User.register({username: req.body.username}, req.body.password, function(err, user) {
                if (err) {
                    console.log(err);
                    res.redirect("/register");
                } else {
                    passport.authenticate("local")(req, res, function() {
                        res.redirect("/list");
                    });
                }
            });
        }
    });
});


app.get('/newitem', function(req, res) {
    if (req.isAuthenticated()) {
        res.render("new");
    } else {
        res.redirect("/login");
    }
});
app.post("/newitem", function(req, res) {

    const itemTitle = req.body.title;
    const itemDeadline = req.body.deadline;
    const itemDesc = req.body.desc;
    
    const date = itemDeadline.split(" ");
    
    console.log(itemTitle);
    console.log(date[0], date[1], date[2]);
    console.log(itemDesc);
    
    const task = new Task ({
        title: itemTitle,
        description: itemDesc,
        deadline: {
            day: date[0],
            month: date[1],
            year: date[2]
        }
    });
    
    User.findOne({username: req.user.username}, function(err, foundUser) {
        foundUser.tasks.push(task);
        foundUser.save();
        res.redirect("/list");
    });
});


app.post("/delete", function(req, res) {
    const checkedItemId = req.body.checkbox;
    const username = req.user.username;

    User.findOneAndUpdate({username: username}, 
        {$pull: {tasks: {_id: checkedItemId}}}, 
        function(err, foundTask) {
            if (!err) {
                res.redirect("list");
            }
        });
});


app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});


let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}
app.listen(port, function() {
    console.log(`Successfully started server on port ${port}`);
});