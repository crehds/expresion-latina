const express = require("express");
const PostersService = require("../../services/posters");
const multer = require("multer");
const router = express.Router();
const postersService = new PostersService();

router.get("/", async function (req, res, next) {
  const { tags } = req.query;
  try {
    const posters = await postersService.getPosters({ tags });
    res.status(200).json({
      data: posters.length,
      message: "posters listed",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:posterId", async function (req, res, next) {
  const { posterId } = req.params;
  try {
    const poster = await postersService.getPoster({ posterId });
    //para veer la imagen en postman
    // res.status(200).type(poster.contentType).send(poster.img.buffer)
    res.status(200).json({
      data: poster,
      message: "poster retrieved",
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  multer({ dest: "../uploads/" }).array("image"),
  async function (req, res, next) {
    if (req.files.length === 0) {
      res.status(200).json({
        data: 0,
        message: "no se cargaron imágenes",
      });
    }
    const { files: posters } = req;
    try {
      const createdPoster = await postersService.createPoster({ posters });

      res.status(201).json({
        data: createdPoster,
        message: "poster created",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:posterId",
  multer({ dest: "../uploads/" }).array("image"),
  async function (req, res, next) {
    const { postersId } = req.params;
    const { files: posters } = req;
    try {
      const updatedPoster = await postersService.updatePoster({
        postersId,
        posters
      });
      res.status(200).json({
        data: updatedPoster,
        message: "poster updated",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/:posterId", async function (req, res, next) {
  const { posterId } = req.params;

  try {
    const deletedPoster = await postersService.deletePoster({
      posterId,
    });
    res.status(200).json({
      data: deletedPoster,
      message: "poster deleted",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/", async function (req, res, next) {
  try {
    const deletedPosters = await postersService.deletePosters();
    res.status(200).json({
      data: deletedPosters,
      message: "All the posters are deleted",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
