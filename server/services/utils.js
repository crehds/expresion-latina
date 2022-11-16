const fs = require('fs');

function createArrayImg(postersId, posters) {
  if (postersId) {
    postersId = postersId.split(',');
  }
  return posters.map((poster, index) => {
    let newImg = fs.readFileSync(poster.path);
    let encImg = newImg.toString('base64');
    let newItem = {
      contentType: poster.mimetype,
      size: poster.size,
      img: Buffer(encImg, 'base64')
    };

    return { id: postersId ? postersId[index] : null, data: newItem };
  });
}

module.exports = createArrayImg;
