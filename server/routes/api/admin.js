const express = require("express");
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

router.post("/createProfesor", async function (req, res, next) {
  try {
    const { profesor } = req.body;
    const profesorCreated = await adminService.createProfesor({profesor});
    res.status(200).json({
      data: profesorCreated,
      message: "profesor created",
    });
  } catch (error) {}
});

module.exports = router;
