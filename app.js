const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2');
const app = express();
const path = require('path');



const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Pr1thyuroot',
    database: 'college_management_system'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Session setup
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

const bcrypt = require('bcrypt');
//const hashedPassword = await bcrypt.hash(password, 10);



// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');


app.get('/signin', (_, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.post('/signin', (req, res) => {
    const { role, username, password } = req.body;

    let query;
    if (role === 'student') {
        query = 'SELECT * FROM students WHERE username = ? AND password = ?';
    } else if (role === 'faculty') {
        query = 'SELECT * FROM faculty WHERE username = ? AND password = ?';
    }

    db.query(query, [username, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.user = results[0]; // Save the logged-in user's data in the session
            if (role === 'student') {
                req.session.studentId = results[0].id; // Save student ID for student dashboard
                return res.redirect('/student/dashboard');
            } else if (role === 'faculty') {
                req.session.facultyId = results[0].id; // Save faculty ID for faculty dashboard
                return res.redirect('/faculty/dashboard');
            }
        } else {
            res.send('Invalid login credentials');
        }
    });
});



// Dashboard routes
app.get('/student/dashboard', (req, res) => {
    if (req.session.user) {
        res.render('student_dashboard', { student: req.session.user });
    } else {
        res.redirect('/signin');
    }
});

app.get('/faculty/dashboard', (req, res) => {
    if (req.session.user) {
        res.render('faculty_dashboard', { faculty: req.session.user });
    } else {
        res.redirect('/signin');
    }
});

// Admin Sign-In Route
app.get('/admin/signin', (_, res) => {
    res.render('admin_signin', { errorMessage: null });
});

app.post('/admin/signin', (req, res) => {
    const { password } = req.body;

    const query = 'SELECT * FROM administrator WHERE password = ?';
    db.query(query, [password], (err, results) => {
        if (err) {
            console.error('Error during admin login:', err);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            req.session.admin = true; // Set admin session
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin_signin', { errorMessage: 'Invalid password' });
        }
    });
});

app.get('/admin/dashboard', (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/signin');
    }

    res.render('admin_dashboard');
});

app.get('/signin', (_, res) => {
    res.render('signin', { errorMessage: null });
});



app.post('/signin', async (req, res) => {
    const { role, username, password } = req.body;

    let query;
    if (role === 'student') {
        query = 'SELECT * FROM students WHERE username = ?';
    } else if (role === 'faculty') {
        query = 'SELECT * FROM faculty WHERE username = ?';
    } else {
        return res.status(400).send('Invalid role');
    }

    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Error retrieving user:', err);
            return res.status(500).send('Error retrieving user');
        }

        if (results.length === 0) {
            return res.render('signin', { errorMessage: 'Invalid login credentials' });
        }

        // Get the stored hashed password
        const storedHashedPassword = results[0].password;

        try {
            // Compare entered password with stored hashed password
            const isPasswordCorrect = await bcrypt.compare(password, storedHashedPassword);

            if (isPasswordCorrect) {
                // Password is correct, save user session and redirect to the dashboard
                req.session.user = results[0]; // Save the logged-in user's data in the session

                if (role === 'student') {
                    req.session.studentId = results[0].id; // Save student ID for student dashboard
                    return res.redirect('/student/dashboard');
                } else if (role === 'faculty') {
                    req.session.facultyId = results[0].id; // Save faculty ID for faculty dashboard
                    return res.redirect('/faculty/dashboard');
                }
            } else {
                // Incorrect password
                res.render('signin', { errorMessage: 'Invalid login credentials' });
            }
        } catch (err) {
            console.error('Error comparing password:', err);
            res.status(500).send('Error during password comparison');
        }
    });
});


// Serve the Create Student form
app.get('/admin/create-student', (_, res) => {
    res.render('create_student');
});


app.post('/admin/create-student', async (req, res) => {
    const { username, password, name, email, faculty_id } = req.body;
    console.log('Received student data:', { username, password, name, email, faculty_id });

    const query = 'INSERT INTO students (username, password, name, email, faculty_id) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [username, password, name, email || null, faculty_id || null], (err, result) => {
        if (err) {
            console.error('Error inserting student:', err);
            return res.status(500).send('Error creating student');
        }
        console.log('Student created successfully:', result);
        res.send('Student created successfully');
    });
});




// Define the route for student attendance page
app.get('/student/attendance', (req, res) => {
    const studentId = req.session.studentId; // Get the student ID from the session

    if (!studentId) {
        return res.redirect('/signin'); // Redirect to the login page if studentId is not found
    }

    // Query to fetch attendance data
    const query = `
        SELECT students.name, attendance.subject, attendance.percentage
        FROM students
        LEFT JOIN attendance ON students.id = attendance.student_id
        WHERE students.id = ?
    `;

    db.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching attendance:', err);
            return res.send('Error fetching attendance');
        }

        const student = { name: results[0]?.name || "Unknown" };
        const attendance = results.map(row => ({
            subject: row.subject,
            percentage: row.percentage
        }));

        // Render the attendance page with the data
        res.render('student_attendence', { student, attendance });
    });
});

// Faculty Attendance Page
app.get('/faculty/attendance', (req, res) => {
    if (req.session.user) {
        res.render('faculty_attendance', { faculty: req.session.user });
    } else {
        res.redirect('/signin');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Error while logging out");
        }
        res.redirect('/signin');
    });
});

app.get('/student/timetable', (req, res) => {
    const student = req.session.user;
    if (student) {
        res.render('student_time_table');
    } else {
        res.redirect('/signin');
    }
});

// Student Marks Page
app.get('/student/marks', (req, res) => {
    const studentId = req.session.studentId; // Get student ID from session

    if (!studentId) {
        return res.redirect('/signin'); // Redirect to login if student ID is not found in session
    }

    // Query to fetch marks data for the logged-in student
    const query = `
        SELECT subject, marks
        FROM marks
        WHERE student_id = ?
    `;

    db.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching marks:', err);
            return res.status(500).send('An error occurred while fetching marks.'); // Better error response
        }

        // Check if results are empty (no marks found)
        if (results.length === 0) {
            return res.render('student_marks', { marks: [], message: 'No marks available.' }); // Render with an empty list and a message
        }

        // Render the student_marks.ejs page with fetched marks
        res.render('student_marks', { marks: results });
    });
});


app.get('/faculty/marks', (req, res) => {
    const facultyId = req.session.facultyId; // Get the faculty ID from the session

    if (!facultyId) {
        return res.redirect('/signin'); // Redirect to login if faculty ID is not found in session
    }
    const query = `
        SELECT students.name AS student_name, marks.subject, marks.marks
        FROM students
        JOIN marks ON students.id = marks.student_id
        WHERE students.faculty_id = ?
    `;

    db.query(query, [facultyId], (err, results) => {
        if (err) {
            console.error('Error fetching marks:', err);
            return res.status(500).send('An error occurred while fetching marks.');
        }
        const message = results.length === 0 ? 'No marks available for your students.' : null;
        res.render('faculty_marks', { marks: results, message: message });
    });
});




app.get('/faculty/messages', (_, res) => {
    res.render('faculty_messages');
});

app.post('/faculty/messages', (req, res) => {
    const message = req.body.message;
    console.log("Message sent to students:", message);
    res.redirect('/faculty/messages');
});


// Student Exams
app.get('/student/exams', (_, res) => {
    const message = "No exams scheduled for you at the moment."; 
    res.render('exams', { message: message });
});

// Route to render admin dashboard
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/signin');
    }
    res.render('admin_dashboard');
});

// Serve the Create Faculty form
app.get('/admin/create/teacher', (_, res) => {
    res.render('create_faculty');
});
// Handle form submission for creating a new teacher (faculty)
app.post('/admin/create/teacher', (req, res) => {
    const { username, password, email, name } = req.body;
    console.log('Received teacher data:', { username, password, email, name });

    // SQL query to insert new faculty data into the faculty table
    const query = 'INSERT INTO faculty (username, email, password, name) VALUES (?, ?, ?, ?)';

    db.query(query, [username, email || null, password, name], (err, result) => {
        if (err) {
            console.error('Error inserting teacher:', err);
            return res.status(500).send('Error creating teacher');
        }
        console.log('Teacher created successfully:', result);
        res.send('Teacher created successfully');
    });
});


// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
