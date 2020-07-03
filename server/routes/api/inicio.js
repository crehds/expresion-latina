const express = require("express");
const router = express.Router();
const PosterService = require("../../services/posters");
const multer = require("multer");

const postersService = new PosterService();
router.get("/", async function (req, res, next) {
  const { tags } = req.query;

  try {
    const posters = await postersService.getPosters({ tags });
    res.status(200).json({
      data: posters,
      message: "posters listeed",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:posterId", async function (req, res, next) {
  const { posterId } = req.params;
  try {
    const product = await postersService.getPoster({ posterId });
    res.status(200).json({
      data: product,
      message: "poster retrieved",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", multer({dest:"../uploads/"}).array("image"), async function (req, res, next) {
  const { files: posters } = req;
  try {
    const createdPoster = await postersService.createPoster({ posters });
    console.log(createdPoster);
    res.status(201).json({
      poster: createdPoster,
      message: "poster created",
    });
  } catch (error) {
    next(error);
  }
});


// router.post("/", multer({dest:"../uploads/"}).single("image"), async function (req, res, next) {
//   const { file: poster } = req;
//   try {
//     const createdPoster = await postersService.createPoster({ poster });
//     res.status(201).json({
//       poster: createdPoster.filename,
//       message: "poster created",
//     });
//   } catch (error) {
//     next(error);
//   }
// });

router.put("/:productId", async function (req, res, next) {
  const { productId } = req.params;
  const { body: product } = req;

  try {
    const updatedProduct = await postersService.updateProduct({
      productId,
      product,
    });
    res.status(200).json({
      data: updatedProduct,
      message: "products updated",
    });
  } catch (error) {
    next(error);
  }
});
router.delete("/", async function (req, res, next){
  try {
    const deletedPosters = await postersService.deletePosters();
    console.log(deletedPosters);
    res.status(200).json({
      result: deletedPosters,
      message: "posters deleted",
    });
  } catch(error) {
    next(error);
  }
})

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

module.exports = router;
