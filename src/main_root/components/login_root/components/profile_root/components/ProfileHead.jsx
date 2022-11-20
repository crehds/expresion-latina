import PropTypes from 'prop-types';
import '../css/profilehead.css';

function handleIcon() {
  const input = document.getElementById('test__userimageprofile-input');

  return input.click();
}

export default function ProfileHead(props) {
  const {
    profile: user, handleSaveUserProfileImage, handleInput, handleCancelInput, handleCheck,
  } = props;
  return (
    <div className="profile-head">
      <h4 className="profile-head__name">
        {`${user.name || user.nombre} ${
          user.lastname || user.apellido
        }`}

      </h4>
      <div className="profile-head__container">
        {user.ruta_imageProfile ? (
          <img src={user.ruta_imageProfile} alt="foto del admin" />
        ) : (
          <img
            src={`${process.env.PUBLIC_URL}/profile/default-user.png`}
            alt="foto del admin"
          />
        )}
        <form
          id="test__userimageprofile"
          onSubmit={handleSaveUserProfileImage}
        >
          <input
            id="test__userimageprofile-input"
            type="file"
            name="imageUserProfile"
            onChange={handleInput}
          />
          <input
            type="submit"
            id="button-profile-head-aux"
          />
        </form>

        <i
          name="check"
          className="icon3-x edit-userimageprofile3"
          onClick={handleCancelInput}
          onKeyDown={handleCancelInput}
          role="button"
          tabIndex={0}
          aria-label="close-user-icon"
        />
        <i
          name="check"
          className="icon3-checkmark edit-userimageprofile2"
          onClick={handleCheck}
          onKeyDown={handleCheck}
          role="button"
          tabIndex={0}
          aria-label="checkmark-user-icon"
        />

        <i
          className="icon3-camera edit-userimageprofile"
          onClick={handleIcon}
          onKeyDown={handleIcon}
          role="button"
          tabIndex={0}
          aria-label="camera-user-icon"
        />
      </div>
    </div>
  );
}
ProfileHead.propTypes = {
  profile: PropTypes.instanceOf(Object).isRequired,
  handleSaveUserProfileImage: PropTypes.func.isRequired,
  handleInput: PropTypes.func.isRequired,
  handleCancelInput: PropTypes.func.isRequired,
  handleCheck: PropTypes.func.isRequired,
};
