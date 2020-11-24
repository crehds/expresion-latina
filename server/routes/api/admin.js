const express = require("express");
const multer = require("multer");
const AdminService = require("../../services/admin");
const router = express.Router();

const adminService = new AdminService();

router.get("/getProfesors", async function (req, res, next) {
  try {
    const result = await adminService.getProfesors();
    console.log(result);
    res.status(200).json({
      data: result,
      message: "data success",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/imageProfesor/:profesorId", async function (req, res, next) {
  try {
    const { profesorId } = req.params;
    const pathImageProfesor = await adminService.getImageProfesor({
      profesorId,
    });
    res.status(200).json({
      data: pathImageProfesor,
      message: "success",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/getAllPathsImagesProfesors", async function (req, res, next) {
  try {
    const pathsImagesProfesors = await adminService.getPathsImagesProfesors();
    res.status(200).json({
      data: pathsImagesProfesors,
      message: "success",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/createProfesor", async function (req, res, next) {
  try {
    const { profesor } = req.body;
    const profesorCreated = await adminService.createProfesor({ profesor });
    res.status(200).json({
      data: profesorCreated,
      message: "profesor created",
    });
  } catch (error) {
    next(error);
  }
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./server/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
var upload = multer({ storage: storage });

router.post(
  "/imageProfesor/:profesorId",
  upload.single("image"),
  async function (req, res, next) {
    const pathImageProfesor = "/static/" + req.file.originalname;
    const { profesorId } = req.params;

    const result = await adminService.saveImageProfesor(
      { profesorId },
      pathImageProfesor
    );
    try {
      res.status(200).json({
        data: result,
        message: "success",
      });
    } catch (error) {
      next(error);
    }
  }
);

// var storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "./server/uploads");
//   },
//   filename: function (req, file, cb)
//   82VARmTH-mJTk~M

//Just for test
router.post(
  "/imagesProfesors",
  multer({ storage: storage }).array("images"),
  async function (req, res, next) {
    try {
      res.status(200).json({
        data: "profesors saved",
        message: "success",
      });
    } catch (error) {
      next(error);
    }
  }
);
module.exports = router;
