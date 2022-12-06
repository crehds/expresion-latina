import '../css/info.css';

function Info() {
  return (
    <div className="info">
      <div className="info__content">
        <ul className="info__menu">
          <li className="info__detail">
            <i className="icon3-whatsapp" />
            <p className="text-sm">984578125</p>
            <i
              className="icon-content_copy info__copy"
            />
          </li>
          <li className="info__detail">
            <i className="icon3-phone2" />
            <p className="text-sm">578125</p>
            <i
              className="icon-content_copy info__copy"
            />
          </li>
          <li className="info__detail">
            <i className="icon3-gmail" />
            <p className="text-sm">expresionlatina@gmail.com</p>
            <i
              className="icon-content_copy info__copy"
            />
          </li>
        </ul>
      </div>

    </div>
  );
}
export default Info;
