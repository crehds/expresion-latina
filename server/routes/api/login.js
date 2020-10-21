const express = require("express");
const router = express.Router();
const LoginService = require("../../services/login");

const loginService = new LoginService();

router.get("/", async function (req, res, next) {
  // console.log(req);

  try {
    const login = await loginService.getLogin();
    res.status(200).json({
      data: login,
      message: "data success",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/findUser", async function (req, res, next) {
  const { login } = req.body;
  try {
    const user = await loginService.getUser(login);
    if (user) {
      res.status(200).json({
        data: user,
        message: "user exists",
      });
    } else {
      res.status(200).json({
        data: user,
        message: "user doesn't exists",
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/TypeOfUser/:typeOfUser", async function (req, res, next) {
  const { typeOfUser } = req.params;
  try {
    const TypeUser = await loginService.GetTypeUser(typeOfUser);
    res.status(200).json({
      data: TypeUser,
      message: "Type of User listed",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/TypesOfUsers", async function (req, res, next) {
  try {
    const TypeUsers = await loginService.GetTypesUsers();
    res.status(200).json({
      data: TypeUsers,
      message: "Types of Users listed",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async function (req, res, next) {
  try {
    const users = await loginService.getUsers();
    res.status(200).json({
      data: users,
      message: "Users listed",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/createUser", async function (req, res, next) {
  const { user, login } = req.body;
  // res.status(200).json({
  //   data:user,
  //   message:"prueba exitosa"
  // })
  try {
    const data = await loginService.createUser({ user, login });
    res.status(200).json({
      data,
      message: "user created",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/updateUser", async function (req, res, next) {
  const { body:user } = req;
  try {
    const data = await loginService.updateUser({ user });
    res.status(200).json({
      data,
      message: "user updated",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
