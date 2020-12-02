const express = require("express");
const multer = require("multer");
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

router.get("/getLogin/:nameLogin", async function (req, res, next) {
  const { nameLogin } = req.params;
  try {
    const NameLogin = await loginService.nameLogin(nameLogin);
    res.status(200).json({
      data: NameLogin,
    });
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
  const { body: user } = req;
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

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./server/uploads/users");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

var upload = multer({ storage: storage });

router.put(
  "/setPathUserProfileImage/:userId",
  upload.single("imageUserProfile"),
  async function (req, res, next) {
    const pathImageUserProfile = "/static/users/" + req.file.originalname;
    const { userId } = req.params;
    try {
      const result = await loginService.setPathUserProfileImage(
        { userId },
        pathImageUserProfile
      );
      console.log(result);
      res.status(200).json({
        data: result,
        message: "success",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/getUserSocialMedias/:userId", async function (req, res, next) {
  const { userId } = req.params;
  try {
    const socialMedias = await loginService.getUserSocialMedias(userId);
    res.status(200).json({
      data: socialMedias,
      message: "success",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/setUserSocialMedias/:userId", async function (req, res, next) {
  const { userId } = req.params;
  const { socialMedias } = req.body;
  console.log(socialMedias);
  try {
    const result = await loginService.setSocialMedias({ socialMedias, userId });
    console.log(result);
    res.status(200).json({
      data: result,
      message: "success",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/updateUserSocialMedia/:userId", async function (req, res, next) {
  const { userId } = req.params;
  const { body: socialMedia } = req;
  try {
    const result = await loginService.updateUserSocialMedia(
      socialMedia,
      userId
    );
    res.status(200).json({
      data: result,
      message: "success",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
