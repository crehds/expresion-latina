function createAdaptedPosters(poster) {
  const {
    _id, originalname, mimetype, size, publicUrl,
  } = poster;

  const { value } = publicUrl;

  const formattedPoster = {
    id: _id,
    filename: originalname,
    mimetype,
    size,
    url: value,
  };

  return formattedPoster;
}

export default createAdaptedPosters;
