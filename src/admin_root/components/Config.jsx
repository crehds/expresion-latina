import React, { Component } from 'react';
import Swal from 'sweetalert2';
import '../css/config.css';

export default class Config extends Component {
  state = {
    addPoster: false,
    updatePoster: false,
    deletePoster: false,
    updateValue: ['1'],
    deletedValue: ['1'],
    image: []
  };
  addPoster = () => {
    if (this.state.addPoster) {
      return this.setState({ addPoster: false });
    }
    return this.setState({ addPoster: true });
  };

  updatePoster = () => {
    if (this.state.updatePoster) {
      return this.setState({ updatePoster: false });
    }
    return this.setState({ updatePoster: true });
  };

  deletePoster = () => {
    if (this.state.deletePoster) {
      return this.setState({ deletePoster: false });
    }
    return this.setState({ deletePoster: true });
  };

  saveImg = (event) => {
    event.preventDefault();
    const image = [...event.target.files].map((file) => {
      let reader = new FileReader();
      let image = new Image();
      reader.readAsDataURL(file);
      reader.onload = () => {
        image.src = reader.result;
      };
      return image;
    });
    return this.setState({ image });
  };

  sendImgs = async (event) => {
    event.preventDefault();
    const form = document.getElementById('form-prueba');
    const formData = new FormData(form);
    const response = await fetch('/inicio', {
      method: 'POST',
      body: formData
    }).then((result) => result.json());
    await this.props.func();
    Swal.fire({
      title: 'Poster creado',
      timer: 1000,
      text: response.message,
      showConfirmButton: false
    });
  };

  updateImgs = async (event) => {
    event.preventDefault();
    const form = document.getElementById('form-prueba2');
    const ids = this.state.updateValue.reduce((acc, cv, index, arr) => {
      if (index === arr.length - 1)
        return (acc += `${this.props.globalProps.data[parseInt(cv) - 1]._id}`);
      return (acc += `${this.props.globalProps.data[parseInt(cv) - 1]._id},`);
    }, '');
    const formData = new FormData(form);

    const response = await fetch(`/inicio/?postersId=${ids}`, {
      method: 'PUT',
      body: formData
    }).then((result) => result.json());
    await this.props.func();
    Swal.fire({
      title: 'Poster(s) actualizado(s)',
      timer: 1000,
      text: response.message,
      showConfirmButton: false
    });
  };

  deleteOne = (event) => {
    event.preventDefault();
    const swal = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
      },
      buttonsStyling: false
    });
    swal
      .fire({
        title: 'Se borrarán las posiciones seleccionadas',
        text: 'asegúrate de tener una copia de ellas',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'No borrar aún',
        reverseButtons: true
      })
      .then(async (result) => {
        const ids = this.state.deletedValue.reduce((acc, cv, index, arr) => {
          if (index === arr.length - 1)
            return (acc += `${
              this.props.globalProps.data[parseInt(cv) - 1]._id
            }`);
          return (acc += `${
            this.props.globalProps.data[parseInt(cv) - 1]._id
          },`);
        }, '');
        if (result.value) {
          const response = await fetch(`/inicio/?postersId=${ids}`, {
            method: 'DELETE'
          }).then((response) => response.json());
          console.log(response);
          await this.props.func();
          swal.fire({
            title: 'Eliminados',
            text: `Todos los ${response.data.length} posters han sido eliminados`,
            icon: 'success'
          });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swal.fire('Acción cancelada', 'posters intactos', 'error');
        }
      });
  };

  deleteAll = () => {
    const swal = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
      },
      buttonsStyling: false
    });
    swal
      .fire({
        title: 'Se borrarán todos las imágenes',
        text: 'asegúrate de tener una copia de ellas',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'No borrar aún',
        reverseButtons: true
      })
      .then(async (result) => {
        if (result.value) {
          const response = await fetch('/inicio', {
            method: 'DELETE'
          }).then((response) => response.json());
          console.log(response);
          swal.fire({
            title: 'Eliminados',
            text: `Todos los ${response.data.deletedCount} posters han sido eliminados`,
            icon: 'success'
          });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          swal.fire('Acción cancelada', 'posters intactos', 'error');
        }
      });
  };

  handleUpdateValue = (e) => {
    let options = e.target.options;
    let updateValue = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        updateValue.push(options[i].value);
      }
    }

    this.setState({ updateValue });
  };

  handleDeleteValue = (e) => {
    let options = e.target.options;
    let deletedValue = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        deletedValue.push(options[i].value);
      }
    }

    this.setState({ deletedValue });
  };
  render() {
    return (
      <div className='config-modal'>
        <h3>Administrador</h3>
        <div className='config-modal__buttons'>
          <button onClick={this.addPoster}>Nuevo Poster</button>
          {this.state.addPoster && (
            <form
              action=''
              id='form-prueba'
              className='config-modal__form'
              onSubmit={this.sendImgs}
            >
              <input
                type='file'
                name='image'
                multiple='multiple'
                onChange={this.saveImg}
              />
              <button type='submit'>Añadir</button>
            </form>
          )}
          <button onClick={this.updatePoster}>
            Actualizar una o más imagenes
          </button>
          {this.state.updatePoster && (
            <form
              action=''
              id='form-prueba2'
              className='config-modal__form'
              onSubmit={this.updateImgs}
            >
              <h6>Tomar como posiciones los números</h6>
              <select
                name='select'
                value={this.state.updateValue}
                onChange={this.handleUpdateValue}
                multiple={true}
              >
                <option value='1'>1</option>
                <option value='2'>2</option>
                <option value='3'>3</option>
                <option value='4'>4</option>
                <option value='5'>5</option>
              </select>
              <input
                type='file'
                name='image'
                multiple='multiple'
                onChange={this.saveImg}
              />
              <button type='submit'>Actualizar</button>
            </form>
          )}
          <button onClick={this.deletePoster}>Eliminar una imagen</button>
          {this.state.deletePoster && (
            <form
              action=''
              id='form-prueba3'
              className='config-modal__form'
              onSubmit={this.deleteOne}
            >
              <h6>Tomar como posiciones los números</h6>
              <select
                name='select'
                value={this.state.deletedValue}
                onChange={this.handleDeleteValue}
                multiple={true}
              >
                <option value='1'>1</option>
                <option value='2'>2</option>
                <option value='3'>3</option>
                <option value='4'>4</option>
                <option value='5'>5</option>
              </select>
              <button type='submit'>Eliminar</button>
            </form>
          )}
          <button onClick={this.deleteAll}>Eliminar Todo</button>
        </div>
      </div>
    );
  }
}
