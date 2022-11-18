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

export default class Profile extends Component {
  constructor(props) {
    super(props);
    const { userRegistered } = props;
    this.state = {
      profile: { ...userRegistered.user },
      socialMedia: {
        facebook: '',
        twitter: '',
        instagram: '',
      },
    };
  }

  componentDidMount() {
    const { getFunction } = this.props;
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
    const { value: link } = await Swal.fire({
      title: 'Ingresa el link',
      input: 'text',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'No haz ingresado nada';
        }
        return 0;
      },
    });
    this.setState({
      socialMedia: {
        ...socialMedia,
        [id]: link,
      },
    });
  };

  render() {
    const { profile, socialMedia } = this.state;
    const { getDataProfile } = this.props;
    return (
      <div className="profile">
        <ProfileHead profile={profile} />
        <ProfileBody
          profile={profile}
          handleChange={this.handleChange}
          addOrUpdate={this.addOrUpdate}
          getDataProfile={getDataProfile}
          gettingAgeUser={gettingAgeUser}
          socialMedia={socialMedia}
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
