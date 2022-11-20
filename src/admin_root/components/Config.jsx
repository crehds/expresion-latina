import { Component } from 'react';
import PropTypes from 'prop-types';
import Swal from 'sweetalert2';
import '../css/config.css';

export default class Config extends Component {
  constructor(props) {
    super(props);
    this.state = {
      addPoster: false,
      updatePoster: false,
      deletePoster: false,
      updateValue: ['1'],
      deletedValue: ['1'],
      image: [],
    };
  }

  addPoster = () => {
    const { addPoster } = this.state;
    return this.setState((prevState) => ({ ...prevState, addPoster: !!addPoster }));
  };

  updatePoster = () => {
    const { updatePoster } = this.state;
    return this.setState((prevState) => ({ ...prevState, updatePoster: !!updatePoster }));
  };

  deletePoster = () => {
    const { deletePoster } = this.state;
    return this.setState((prevState) => ({ ...prevState, deletePoster: !!deletePoster }));
  };

  saveImg = (event) => {
    event.preventDefault();
    const image = [...event.target.files].map((file) => {
      const reader = new FileReader();
      const imageTag = new Image();
      reader.readAsDataURL(file);
      reader.onload = () => {
        imageTag.src = reader.result;
      };
      return imageTag;
    });

    return this.setState((prevState) => ({ ...prevState, image }));
  };

  sendImgs = async (event) => {
    event.preventDefault();
    const { func } = this.props;
    const form = document.getElementById('form-prueba');
    const formData = new FormData(form);
    const response = await fetch('/inicio', {
      method: 'POST',
      body: formData,
    }).then((result) => result.json());
    await func();
    Swal.fire({
      title: 'Poster creado',
      timer: 1000,
      text: response.message,
      showConfirmButton: false,
    });
  };

  updateImgs = async (event) => {
    event.preventDefault();
    const { updateValue } = this.state;
    const { func, globalProps } = this.props;
    const form = document.getElementById('form-prueba2');
    const ids = updateValue.reduce((acc, cv, index, arr) => {
      if (index === arr.length - 1) {
        return (acc + globalProps.data[parseInt(cv, 10) - 1].id);
      }
      return (`${acc}${globalProps.data[parseInt(cv, 10) - 1].id},`);
    }, '');
    const formData = new FormData(form);

    const response = await fetch(`/inicio/?postersId=${ids}`, {
      method: 'PUT',
      body: formData,
    }).then((result) => result.json());
    await func();
    Swal.fire({
      title: 'Poster(s) actualizado(s)',
      timer: 1000,
      text: response.message,
      showConfirmButton: false,
    });
  };

  deleteOne = (event) => {
    event.preventDefault();
    const { deletedValue } = this.state;
    const { func, globalProps } = this.props;
    const swal = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger',
      },
      buttonsStyling: false,
    });
    swal
      .fire({
        title: 'Se borrarán las posiciones seleccionadas',
        text: 'asegúrate de tener una copia de ellas',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'No borrar aún',
        reverseButtons: true,
      })
      .then(async (result) => {
        const ids = deletedValue.reduce((acc, cv, index, arr) => {
          if (index === arr.length - 1) {
            return (`${acc}${
              globalProps.data[parseInt(cv, 10) - 1].id
            }`);
          }
          return (`${acc}${
            globalProps.data[parseInt(cv, 10) - 1].id
          },`);
        }, '');
        if (result.value) {
          const deletedPoster = await fetch(`/inicio/?postersId=${ids}`, {
            method: 'DELETE',
          }).then((response) => response.json());
          await func();
          swal.fire({
            title: 'Eliminados',
            text: `Todos los ${deletedPoster.data.length} posters han sido eliminados`,
            icon: 'success',
          });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swal.fire('Acción cancelada', 'posters intactos', 'error');
        }
      });
  };

  // eslint-disable-next-line class-methods-use-this
  deleteAll = () => {
    const swal = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger',
      },
      buttonsStyling: false,
    });
    swal
      .fire({
        title: 'Se borrarán todos las imágenes',
        text: 'asegúrate de tener una copia de ellas',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'No borrar aún',
        reverseButtons: true,
      })
      .then(async (result) => {
        if (result.value) {
          const deletedPosters = await fetch('/inicio', {
            method: 'DELETE',
          }).then((response) => response.json());
          swal.fire({
            title: 'Eliminados',
            text: `Todos los ${deletedPosters.data.deletedCount} posters han sido eliminados`,
            icon: 'success',
          });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swal.fire('Acción cancelada', 'posters intactos', 'error');
        }
      });
  };

  handleUpdateValue = (e) => {
    const { options } = e.target;
    const updateValue = [];
    for (let i = 0, l = options.length; i < l; i += 1) {
      if (options[i].selected) {
        updateValue.push(options[i].value);
      }
    }

    this.setState({ updateValue });
  };

  handleDeleteValue = (e) => {
    const { options } = e.target;
    const deletedValue = [];
    for (let i = 0, l = options.length; i < l; i += 1) {
      if (options[i].selected) {
        deletedValue.push(options[i].value);
      }
    }

    this.setState({ deletedValue });
  };

  render() {
    const {
      addPoster, updatePoster, updateValue, deletePoster, deletedValue,
    } = this.state;
    return (
      <div className="config-modal">
        <h3>Administrador</h3>
        <div className="config-modal__buttons">
          <button type="button" onClick={this.addPoster}>Nuevo Poster</button>
          {addPoster && (
            <form
              action=""
              id="form-prueba"
              className="config-modal__form"
              onSubmit={this.sendImgs}
            >
              <input
                type="file"
                name="image"
                multiple="multiple"
                onChange={this.saveImg}
              />
              <button type="submit">Añadir</button>
            </form>
          )}
          <button type="button" onClick={this.updatePoster}>
            Actualizar una o más imagenes
          </button>
          {updatePoster && (
            <form
              action=""
              id="form-prueba2"
              className="config-modal__form"
              onSubmit={this.updateImgs}
            >
              <h6>Tomar como posiciones los números</h6>
              <select
                name="select"
                value={updateValue}
                onChange={this.handleUpdateValue}
                multiple
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <input
                type="file"
                name="image"
                multiple="multiple"
                onChange={this.saveImg}
              />
              <button type="submit">Actualizar</button>
            </form>
          )}
          <button type="button" onClick={this.deletePoster}>Eliminar una imagen</button>
          {deletePoster && (
            <form
              action=""
              id="form-prueba3"
              className="config-modal__form"
              onSubmit={this.deleteOne}
            >
              <h6>Tomar como posiciones los números</h6>
              <select
                name="select"
                value={deletedValue}
                onChange={this.handleDeleteValue}
                multiple
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <button type="submit">Eliminar</button>
            </form>
          )}
          <button type="submit" onClick={this.deleteAll}>Eliminar Todo</button>
        </div>
      </div>
    );
  }
}

Config.propTypes = {
  func: PropTypes.func.isRequired,
  globalProps: PropTypes.instanceOf(Array).isRequired,
};
