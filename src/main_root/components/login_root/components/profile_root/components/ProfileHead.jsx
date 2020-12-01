import React from "react";
import "../css/profilehead.css";
export default function ProfileHead(props) {
  const { profile: user } = props;
  return (
    <div className="profile-head">
      <h4 className="profile-head__name">{`${user.name || user.nombre} ${
        user.lastname || user.apellido
      }`}</h4>
      <div className="profile-head__container">
        {user.ruta_imageProfile ? (
          <img src={user.ruta_imageProfile} alt="foto del admin" />
        ) : (
          <img
            src={process.env.PUBLIC_URL + "/profile/default-user.png"}
            alt="foto del admin"
          />
        )}
        <form
          id="test__userimageprofile"
          onSubmit={props.handleSaveUserProfileImage}
        >
          <input
            id="test__userimageprofile-input"
            type="file"
            name="imageUserProfile"
            onChange={props.handleInput}
          />
          <button
            type="submit"
            form="test__userimageprofile"
            id="button-profile-head-aux"
          ></button>
        </form>

        <i
          name="check"
          className="icon3-x edit-userimageprofile3"
          onClick={props.handleCancelInput}
        ></i>
        <i
          name="check"
          className="icon3-checkmark edit-userimageprofile2"
          onClick={props.handleCheck}
        ></i>

        <i
          className="icon3-camera edit-userimageprofile"
          onClick={handleicon}
        ></i>
      </div>
    </div>
  );
}

const handleicon = (event) => {
  let input = document.getElementById("test__userimageprofile-input");

  return input.click();
};
