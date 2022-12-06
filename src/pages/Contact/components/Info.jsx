import '../css/info.css';

function Info() {
  return (
    <div className="info">
      <div className="info__content">
        <ul className="info__menu">
          <li className="info__detail">
            <i className="icon-whatsapp" />
            <p className="text-sm">984578125</p>
            <i
              className="icon-content_copy info__copy"
            />
          </li>
          <li className="info__detail">
            <i className="icon-phone" />
            <p className="text-sm">578125</p>
            <i
              className="icon-content_copy info__copy"
            />
          </li>
          <li className="info__detail">
            <i className="icon-envelope" />
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
