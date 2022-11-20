import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/profile.css';
import Swal from 'sweetalert2';
import ProfileHead from './components/ProfileHead';
import ProfileBody from './components/ProfileBody';

function gettingAgeUser(user) {
  const temp = new Date(Date.now() - new Date(user.fechaNacimiento).getTime());

  return Math.abs(temp.getUTCFullYear() - 1970);
}

function handleInputCheck(display) {
  const inputCheck = document.getElementsByName('check');
  inputCheck[0].style.display = display;
  inputCheck[1].style.display = display;
}

function handleInfoUserSocialMedias() {
  Swal.fire({
    icon: 'info',
    title: 'Redes Sociales',
    text:
      'Al activar o desactivar el cuadrado(cerca al icono) controlaras que red social mostrar en tu perfil',
  });
}

function handleCheck() {
  const button = document.getElementById('button-profile-head-aux');
  handleInputCheck('none');
  return button.click();
}

export default class Profile extends Component {
  constructor(props) {
    super(props);
    const { userRegistered } = props;
    this.state = {
      profile: { ...userRegistered.user },
      socialMedia: {
        facebook: {
          link: '',
          estado: 0,
        },
        twitter: {
          link: '',
          estado: 0,
        },
        instagram: {
          link: '',
          estado: 0,
        },
      },
    };
  }

  componentDidMount() {
    const { getFunction } = this.props;
    const { profile } = this.state;
    this.getUserSocialMedias(profile.idUsuario);
    getFunction(this.updateProfile);
  }

  updateProfile = async () => {
    const { profile } = this.state;
    await fetch('/login/updateUser', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });
  };

  handleChange = (e) => {
    const { profile } = this.state;
    this.setState({
      profile: {
        ...profile,
        [e.target.name]: e.target.value,
      },
    });
  };

  addOrUpdate = async (event) => {
    const { socialMedia } = this.state;
    const { id } = event.target;
    await Swal.fire({
      title: 'Ingresa el link',
      input: 'text',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'No haz ingresado nada';
        }
        return 0;
      },
      showLoaderOnConfirm: true,
      preConfirm: (value) => fetch(
        '/login/updateUserSocialMedia/$.profile.idUsuario}',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            socialMediaId: id,
            link: value,
            estado: socialMedia[socialMedia].estado,
          }),
        },
      ).then(() => value),
    }).then(async (result) => {
      if (result.isConfirmed) {
        this.setState({
          socialMedia: {
            ...socialMedia,
            [socialMedia]: {
              ...socialMedia[socialMedia],
              link: result.value,
            },
          },
        });
        Swal.fire({
          title: `${socialMedia} actualizado`,
        });
      }
    });
  };

  handleCancelInput = () => {
    const { profile } = this.state;
    const inputCancel = document.getElementById('test__userimageprofile-input');
    inputCancel.value = '';
    handleInputCheck('none');
    return this.setState({
      profile: {
        ...profile,
        ruta_imageProfile: profile.old_imageProfile,
        old_imageProfile: '',
      },
    });
  };

  handleInput = (event) => {
    event.preventDefault();
    const file = event.target.files[0];
    if (file) {
      handleInputCheck('block');
      const reader = new FileReader();
      const image = new Image();
      reader.readAsDataURL(file);
      reader.onload = () => {
        image.src = reader.result;
        this.setState((prevState) => (prevState.profile.old_imageProfile
          ? {
            profile: {
              ...prevState.profile,
              ruta_imageProfile: image.src,
            },
          }
          : {
            profile: {
              ...prevState.profile,
              old_imageProfile: prevState.profile.ruta_imageProfile,
              ruta_imageProfile: image.src,
            },
          }));
      };
    }
  };

  getUserSocialMedias = async (userId) => {
    const socialMedias = await fetch(
      `/login/getUserSocialMedias/${userId}`,
    ).then((result) => result.json());
    return this.setState((state) => {
      const obj = { ...state.socialMedia };
      Object.keys(state.socialMedia).forEach((key, i) => {
        obj[key].link = socialMedias.data[i].link;
        obj[key].estado = socialMedias.data[i].estado;
      });
      return { socialMedia: obj };
    });
  };

  handleSaveUserProfileImage = async (event) => {
    event.preventDefault();
    const { profile } = this.state;
    const form = document.getElementById('test__userimageprofile');
    const formData = new FormData(form);
    await fetch('/login/setPathUserProfileImage/1', {
      method: 'PUT',
      body: formData,
    });

    this.setState({
      profile: {
        ...profile,
        old_imageProfile: profile.ruta_imageProfile,
      },
    });
    Swal.fire({
      title: 'Foto Actualizada',
    });
  };

  handleInputChecked = (event) => {
    const { socialMedia } = this.state;
    const estado = event.target.checked;
    this.setState({
      socialMedia: {
        ...socialMedia,
        [event.target.name]: {
          ...socialMedia[event.target.name],
          estado,
        },
      },
    });
  };

  render() {
    const { profile, socialMedia } = this.state;
    const { getDataProfile } = this.props;
    return (
      <div className="profile">
        <ProfileHead
          profile={profile}
          handleSaveUserProfileImage={this.handleSaveUserProfileImage}
          handleInput={this.handleInput}
          handleCancelInput={this.handleCancelInput}
          handleCheck={handleCheck}
        />
        <ProfileBody
          profile={profile}
          handleChange={this.handleChange}
          addOrUpdate={this.addOrUpdate}
          getDataProfile={getDataProfile}
          gettingAgeUser={gettingAgeUser}
          socialMedia={socialMedia}
          handleInfoUserSocialMedias={handleInfoUserSocialMedias}
          handleInputChecked={this.handleInputChecked}
        />
      </div>
    );
  }
}

Profile.propTypes = {
  getDataProfile: PropTypes.func.isRequired,
  getFunction: PropTypes.func.isRequired,
  userRegistered: PropTypes.instanceOf(Object).isRequired,
};
