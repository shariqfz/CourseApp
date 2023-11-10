const express = require('express');
const jwt = require('jsonwebtoken');
const { SECRET } = require("../middleware/auth")
const { authenticateJwt } = require("../middleware/auth");

const router = express.Router();
const { pool } = require("../db/dbConfig");
const multer = require('multer');
const fs = require('fs');
const path = require('path');



const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const courseId = req.params.courseId;
    console.log('file info:');
    console.log(req.headers.fileinfo);
    let jsondata = JSON.parse(req.headers.fileinfo);
    const fileTitle = jsondata.fileTitle;
    console.log(`Titlee : ${fileTitle}`);
    const dirPath = `./public/courseId_${courseId}/${fileTitle}`;

    fs.mkdirSync(dirPath, { recursive: true });

    // let jsondata = JSON.stringify(data); 
    fs.writeFile(`./public/courseId_${courseId}/${fileTitle}/fileinfo.json`, req.headers.fileinfo, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("JSON file written successfully");
      }
    });

    return callback(null, dirPath);
  },
  filename: (req, file, callback) => {
    return callback(null, `${Date.now()}_${file.originalname}`)
  }
})

const uploadHandler = multer({storage})

router.post('/upload/:courseId', authenticateJwt, uploadHandler.single('file'), (req, res) => {
  // console.log(req.body);
  console.log(req.file);
  const title = req.body.title; 
  console.log(`Titlee of file: ${title}`);
  res.json({message: "Upload successfull at server"})
})

router.get('/upload/:courseId', authenticateJwt, (req, res) => {
  // sends file names only

  const courseId = req.params.courseId;
  // const directoryPath = path.join(__dirname, `./public/couseId_${courseId}`);
  const directoryPath = `./public/courseId_${courseId}`
  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      console.log(err);
      res.status(500).send('Unable to scan directory: ' + err);
      return;
    } 
    // res.send(files.map((filename) => {return {fileName, fileType}}));
    res.send(files.filter(item => item !== "fileinfo.json"));
  });
});

/* new send file content */

router.get('/upload/:courseId/:fileTitle', authenticateJwt, async (req, res) => {
  const courseId = req.params.courseId;
  const fileTitle = req.params.fileTitle;
  const directoryPath = `./public/courseId_${courseId}/${fileTitle}`;
  
  try {
    const files = await fs.promises.readdir(directoryPath);
    console.log(`files found in ${fileTitle} dir: ${files}`);
    const filename = files.filter(item => item !== "fileinfo.json")[0];
    const filePath = path.join(directoryPath, filename);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase(); 
    let contentType;

    if (ext === '.txt') {
      contentType = 'text/plain';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
    }
  
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileSize
    });

    console.log(`filename: ${filename}   filetype: ${contentType}`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (err) {
      console.log(err);
      res.status(500).send('Unable to scan directory: ' + err);
  }

});

/* old send file content */

// router.get('/upload/:courseId/:fileTitle', authenticateJwt, (req, res) => {
//   // sends actual file
//   const courseId = req.params.courseId;
//   const fileTitle = req.params.fileTitle;
//   console.log(`fileTitle rcvd: ${fileTitle}`)
//   // const directoryPath = path.join(__dirname, `./public/couseId_${courseId}`);
//   const directoryPath = `./public/courseId_${courseId}/${fileTitle}`
//   fs.readdir(directoryPath, function (err, files) {
//     if (err) {
//       console.log(err);
//       res.status(500).send('Unable to scan directory: ' + err);
//       return;
//     }
//     console.log(`files found in ${fileTitle} dir: ${files}`) 
//     // res.send(files);
//     const fileType = null;
//     fs.readFile(path.join(directoryPath, "fileinfo.json"), 'utf8' , (err, data) => {
//       if (err) {
//           console.error(err);
//           return res.sendStatus(500);
//       }
//       const fileinfo = JSON.parse(data);
//       const fileType = String(fileinfo.fileType);
//       console.log(`filetype: ${fileType}`);
      
//       // if (path.extname(files[0]) == ".txt"){
//       const filename = files.filter(item => item !== "fileinfo.json")[0];
//       console.log(`filename: ${filename}   filetype: ${fileType}`);
//       if (fileType == "text"){
//         const filePath = path.join(directoryPath, filename); 
//         console.log(`filename: ${filename}   filetype: ${fileType}   2`);
//         fs.readFile(filePath, 'utf8' , (err, data) => {
//         if (err) {
//             console.error(err);
//             return res.sendStatus(500);
//         }
//         res.send(data);
//         return;
//         });
//       } 
//     })
//   });
// });

router.get("/me", authenticateJwt, async (req, res) => {
  
    console.log("admin/me :");
    console.log(req.user);
    pool.query(`SELECT * FROM users WHERE email = $1`, [req.user.username], (err, dbres) => {
      if (err){
        throw err;
      }
      else{
        if (dbres.rows.length == 0){
          res.status(403).json({message: "Admin doesnt exist"})
          return
        }
        res.json({username: dbres.rows[0].email, userType: dbres.rows[0].type, userCourses: dbres.rows[0].subscribedCourses })
      }
    })    
});

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    let errors = [];
    if (!username || !password){
      errors.push({message: "Please enter all fields."})
    }

    // add more error test cases here

    if (errors.length > 0){
      res.status(403).json({message: errors});
    }
    else{
      // Form validation passed
      const token = jwt.sign({ username, role: 'admin' }, SECRET, { expiresIn: '1h' });
      pool.query(`SELECT * FROM users
                  WHERE email = $1`, [username], (err, dbres) => {
                    if (err) {
                      console.log(err);
                    }
                    // console.log(dbres.rows);
                    if (dbres.rows.length > 0 ){
                      errors.push({message: "Email Already Exists."})
                      res.status(403).json({message: "Email Already Exists."});
                    }
                    else{
                      pool.query(`INSERT INTO users (email, password, type)
                                  VALUES ($1, $2, $3)
                                  RETURNING id, password`, [username, password, 'admin'], (err, dbres) => {
                                    if (err) {
                                      console.log(err);
                                    }
                                    else{
                                      console.log(dbres.rows);
                                      res.json({ message: 'Admin created successfully', token });
                                    }
                                  })
                    }
                  })
    }
  });
  
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(username);
    pool.query(`SELECT * FROM users WHERE email = $1 AND password = $2`, [username, password], (dberr, dbres) => {
      if (dberr){
        console.log(dberr);
        return;
      }
      console.log("admin/login (post)");
      console.log(dbres.rows); // user row from db
      
      if (dbres.rows.length == 0){
        
        res.status(403).json({ message: 'Invalid email or password' });
      }
      else {
        const token = jwt.sign({ username, role: 'admin' }, SECRET, { expiresIn: '2h' });
        res.json({ message: 'success login', user: dbres.rows[0], token }); //sent user object back to client, setting in component LoginBox/Button/Login
      }
      
    })
  });
  
  router.post('/courses', authenticateJwt, async (req, res) => {
    // const course = new Course(req.body);
    const { title, instructor, imageLink, subscribers} = req.body;
    pool.query(`SELECT * FROM courses WHERE "courseTitle" = $1`, [title], (dberr, dbres) => {
      if (dberr) {
        console.log(dberr);
      }
      if (dbres.rows.length > 0) {
        res.status(401).json({message : "Course title already exists"})
        return
      }
      else{
        pool.query(`INSERT INTO courses ("courseTitle", "courseInstructor", "imageLink", "subscribers")
                                  VALUES ($1, $2, $3, $4)
                                  RETURNING "courseId", "courseTitle"`, [title, instructor, imageLink, subscribers], (dberr, dbres) => {
                                    if (dberr) {
                                      console.log(dberr);
                                    }
                                    else{
                                      console.log(dbres.rows);
                                      const course = dbres.rows[0]
                                      res.json({ message: 'Course created successfully', courseId: course.courseId, courseTitle: course.courseTitle });
                                    }
                                  })
      }
    })
  });
  
  router.put('/courses/:courseId', authenticateJwt, async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.courseId, req.body, { new: true });
    if (course) {
      res.json({ message: 'Course updated successfully' });
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  });
  
  router.get('/courses', authenticateJwt, async (req, res) => {
    // const courses = await Course.find({});
    console.log("Getting all courses");
    pool.query(`SELECT * FROM courses ORDER BY "courseId" ASC`, [], (dberr, dbres) => {
      if (dberr) {
        throw dberr;
      }
      
      if (dbres.rows.length == 0) {
        res.json({courses : []});
      }
      else {
        res.json({courses : dbres.rows});
      }
    })
  });
  
  router.get('/course/:courseId', authenticateJwt, async (req, res) => {
    const courseId = req.params.courseId;
    pool.query(`SELECT * FROM courses WHERE "courseId" = $1`, [courseId], (dberr, dbres) => {
      if (dberr) {
        throw dberr;
      }
      if (dbres.rows.length == 0) {
        res.json({courses : []});
      }
      else {
        console.log(dbres.rows[0]);
        res.json({course : dbres.rows[0]});
      }
    })
  });

  router.post('/courses/:courseId', authenticateJwt, async (req, res) => {
    const courseId = req.params.courseId;
    //check if users exists
    pool.query(`SELECT * FROM users WHERE email = $1`, [req.body.username], (dberr, dbres) => {
      if (dberr) {
        console.log(dberr);
        return;
      }
      if (dbres.rows.length == 0) {
        res.json({message : "User does not exist"});
        return;
      }
    })

    //check if course already subscribed
    pool.query(`SELECT * FROM users WHERE email = $1 AND $2 = ANY("subscribedCourses");`, [req.body.username, courseId],
          (dberr, dbres) => {
            if (dberr) {
              console.log(dberr);
            }
            if (dbres.rows.length != 0) {
              res.json({message : "Course Already registered"});
            }

            else {  // course not already registered
              
              // add course to users table entry 
              pool.query(`UPDATE users SET "subscribedCourses" = array_append("subscribedCourses", $1)
              WHERE email = $2`, [courseId, req.body.username], (dberr, dbres) => {
                if (dberr) {
                  console.log(dberr);
                }  
                // else{
                //   res.json({ message: 'Course registered successfully' });
                // }
              });

              // add user to courses table entry
              pool.query(`UPDATE courses SET "subscribers" = array_append("subscribers", $1)
              WHERE "courseId" = $2`, [req.body.username, courseId], (dberr, dbres) => {
                if (dberr) {
                  console.log(dberr);
                }
                else{
                  res.json({ message: 'Course registered successfully' });
                }
              });    
            }
          })
    });

  router.put('/deletecourse/:courseId', authenticateJwt, async (req, res) => {
    const courseId = req.params.courseId;
    //check if course is subscribed or not
    pool.query(`SELECT * FROM users WHERE email = $1 AND $2 = ANY("subscribedCourses");`, [req.body.username, courseId],
        (dberr, dbres) => {
          if (dberr) {
            console.log(dberr);
          }
          if (dbres.rows.length == 0) {
            // course does not exist
            res.json({message : "Course Not Registered. Please refresh."});
          }
          else { // course exists
            console.log("going to delete course")

            // drop course entry from users table
            pool.query(`UPDATE users SET "subscribedCourses" = array_remove("subscribedCourses", $1)
            WHERE email = $2`, [courseId, req.body.username], (dberr, dbres) => {
              if (dberr) {
                console.log(dberr);
              }
              // else{
              //   res.json({ message: 'Course Dropped Successfully' });
              // }
            });
          
            
            // drop user's entry from courses table
            pool.query(`UPDATE courses SET "subscribers" = array_remove("subscribers", $1)
            WHERE "courseId" = $2`, [req.body.username, courseId], (dberr, dbres) => {
              if (dberr) {
                console.log(dberr);
              }
              else{
                res.json({ message: 'Course Dropped Successfully' });
              }
            }); 
          }
        })
    });


  router.get('/courses/:courseId/users', authenticateJwt, async (req, res) => {
    const courseId = req.params.courseId;
    console.log("gettuing users courses id");
    console.log(courseId);
    pool.query(`SELECT * FROM users WHERE $1 = ANY("subscribedCourses") ORDER BY email ASC`, [courseId], (dberr, dbres) => {
      if (dberr) {
        throw dberr;
      }
      
      if (dbres.rows.length == 0) {
        res.json({users : []});
        console.log("gettuing users");
        console.log(dbres.rows);
      }
      else {
        res.json({users : dbres.rows});
        console.log("gettuing users");
        console.log(dbres.rows);
      }
    })
  });
module.exports = router