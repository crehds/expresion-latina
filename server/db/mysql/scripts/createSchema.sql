-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema expresionlatina
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema expresionlatina
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `expresionlatina`;
CREATE SCHEMA IF NOT EXISTS `expresionlatina` DEFAULT CHARACTER SET utf8 ;
USE `expresionlatina` ;

-- -----------------------------------------------------
-- Table `expresionlatina`.`tipo_acceso`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`tipo_acceso` (
  `idTipo_acceso` INT NOT NULL,
  `tipo_acceso` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idTipo_acceso`),
  UNIQUE INDEX `tipo_acceso_UNIQUE` (`tipo_acceso` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`tipo_usuario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`tipo_usuario` (
  `idTipo_usuario` INT NOT NULL,
  `tipo_usuario` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idTipo_usuario`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`usuario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`usuario` (
  `idUsuario` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(45) NOT NULL,
  `apellido` VARCHAR(45) NOT NULL,
  `nickname` VARCHAR(45) NULL DEFAULT NULL,
  `fechaNacimiento` DATE NOT NULL,
  `email` VARCHAR(45) NOT NULL,
  `telefono` VARCHAR(45) NOT NULL,
  `genero` CHAR(1) NOT NULL,
  `Tipo_usuario` INT NOT NULL,
  `ruta_imageProfile` VARCHAR(45) NULL,
  PRIMARY KEY (`idUsuario`, `Tipo_usuario`),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) VISIBLE,
  UNIQUE INDEX `idUsuario_UNIQUE` (`idUsuario` ASC) VISIBLE,
  UNIQUE INDEX `nickname_UNIQUE` (`nickname` ASC) VISIBLE,
  INDEX `fk_usuario_tipo_usuario1_idx` (`Tipo_usuario` ASC) VISIBLE,
  CONSTRAINT `fk_usuario_tipo_usuario1`
    FOREIGN KEY (`Tipo_usuario`)
    REFERENCES `expresionlatina`.`tipo_usuario` (`idTipo_usuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`login`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`login` (
  `idLogin` INT NOT NULL AUTO_INCREMENT,
  `login_name` VARCHAR(15) NOT NULL,
  `login_password` VARCHAR(20) NOT NULL,
  `Usuario` INT NOT NULL,
  PRIMARY KEY (`idLogin`, `Usuario`),
  UNIQUE INDEX `login_name_UNIQUE` (`login_name` ASC) VISIBLE,
  UNIQUE INDEX `idLogin_UNIQUE` (`idLogin` ASC) VISIBLE,
  INDEX `fk_login_usuario1_idx` (`Usuario` ASC) VISIBLE,
  CONSTRAINT `fk_login_usuario1`
    FOREIGN KEY (`Usuario`)
    REFERENCES `expresionlatina`.`usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`acceso`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`acceso` (
  `idAcceso` INT NOT NULL AUTO_INCREMENT,
  `fecha_inicio` VARCHAR(45) NOT NULL,
  `fecha_fin` VARCHAR(45) NOT NULL,
  `nro_clases` INT NOT NULL DEFAULT 12,
  `Login` INT NOT NULL,
  `Tipo_acceso` INT NOT NULL,
  PRIMARY KEY (`idAcceso`, `Login`, `Tipo_acceso`),
  INDEX `fk_Acceso_tipo_acceso1_idx` (`Tipo_acceso` ASC) VISIBLE,
  INDEX `fk_acceso_login1_idx` (`Login` ASC) VISIBLE,
  CONSTRAINT `fk_Acceso_tipo_acceso1`
    FOREIGN KEY (`Tipo_acceso`)
    REFERENCES `expresionlatina`.`tipo_acceso` (`idTipo_acceso`),
  CONSTRAINT `fk_acceso_login1`
    FOREIGN KEY (`Login`)
    REFERENCES `expresionlatina`.`login` (`idLogin`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`genero_baile`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`genero_baile` (
  `idGenero_baile` INT NOT NULL AUTO_INCREMENT,
  `genero_baile` VARCHAR(45) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT '1',
  PRIMARY KEY (`idGenero_baile`),
  UNIQUE INDEX `genero_baile_UNIQUE` (`genero_baile` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`nivel_clase_baile`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`nivel_clase_baile` (
  `idNivel_Clase_Baile` INT NOT NULL,
  `nivel_Clase_Baile` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idNivel_Clase_Baile`),
  UNIQUE INDEX `Nivel_Clase_Baile_UNIQUE` (`nivel_Clase_Baile` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`profesor` (
  `idProfesor` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(45) NOT NULL,
  `apellido` VARCHAR(45) NOT NULL,
  `nickname` VARCHAR(45) NULL DEFAULT NULL,
  `fechaNacimiento` DATE NOT NULL,
  `email` VARCHAR(45) NOT NULL,
  `telefono` VARCHAR(45) NOT NULL,
  `genero` CHAR(1) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT '1',
  `ruta_imageProfile` VARCHAR(45) NULL,
  `ruta_imageProfesor` VARCHAR(45) NULL,
  PRIMARY KEY (`idProfesor`),
  UNIQUE INDEX `idProfesor_UNIQUE` (`idProfesor` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`clase_baile`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`clase_baile` (
  `idClase_baile` INT NOT NULL AUTO_INCREMENT,
  `nombre_clase_baile` VARCHAR(45) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT '1',
  `Profesor` INT NOT NULL,
  `Nivel_Clase_Baile` INT NOT NULL,
  `Genero_baile` INT NOT NULL,
  PRIMARY KEY (`idClase_baile`, `Profesor`, `Nivel_Clase_Baile`, `Genero_baile`),
  INDEX `fk_Clase_Baile_Profesor1_idx` (`Profesor` ASC) VISIBLE,
  INDEX `fk_Clase_Baile_Nivel_Clase_Baile1_idx` (`Nivel_Clase_Baile` ASC) VISIBLE,
  INDEX `fk_Clase_Baile_Genero_baile1_idx` (`Genero_baile` ASC) VISIBLE,
  CONSTRAINT `fk_Clase_Baile_Genero_baile1`
    FOREIGN KEY (`Genero_baile`)
    REFERENCES `expresionlatina`.`genero_baile` (`idGenero_baile`),
  CONSTRAINT `fk_Clase_Baile_Nivel_Clase_Baile1`
    FOREIGN KEY (`Nivel_Clase_Baile`)
    REFERENCES `expresionlatina`.`nivel_clase_baile` (`idNivel_Clase_Baile`),
  CONSTRAINT `fk_Clase_Baile_Profesor1`
    FOREIGN KEY (`Profesor`)
    REFERENCES `expresionlatina`.`profesor` (`idProfesor`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`acceso_a_clase`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`acceso_a_clase` (
  `Acceso_idAcceso` INT NOT NULL,
  `Clase_Baile_idClase_baile` INT NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`Acceso_idAcceso`, `Clase_Baile_idClase_baile`),
  INDEX `fk_Acceso_a_Clase_Clase_Baile1_idx` (`Clase_Baile_idClase_baile` ASC) VISIBLE,
  CONSTRAINT `fk_Acceso_a_Clase_Acceso1`
    FOREIGN KEY (`Acceso_idAcceso`)
    REFERENCES `expresionlatina`.`acceso` (`idAcceso`),
  CONSTRAINT `fk_Acceso_a_Clase_Clase_Baile1`
    FOREIGN KEY (`Clase_Baile_idClase_baile`)
    REFERENCES `expresionlatina`.`clase_baile` (`idClase_baile`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`video_baile`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`video_baile` (
  `idVideo_baile` VARCHAR(45) NOT NULL,
  `visible` TINYINT NOT NULL,
  `nombre` VARCHAR(45) NOT NULL,
  `ruta` VARCHAR(45) NOT NULL,
  `fecha_subida` VARCHAR(45) NOT NULL,
  `Profesor` INT NOT NULL,
  `Nivel_Clase_Baile` INT NOT NULL,
  `Genero_baile` INT NOT NULL,
  PRIMARY KEY (`idVideo_baile`, `Profesor`, `Nivel_Clase_Baile`, `Genero_baile`),
  INDEX `fk_Video_baile_Profesor1_idx` (`Profesor` ASC) VISIBLE,
  INDEX `fk_Video_baile_Nivel_Clase_Baile1_idx` (`Nivel_Clase_Baile` ASC) VISIBLE,
  INDEX `fk_Video_baile_Genero_baile1_idx` (`Genero_baile` ASC) VISIBLE,
  CONSTRAINT `fk_Video_baile_Nivel_Clase_Baile1`
    FOREIGN KEY (`Nivel_Clase_Baile`)
    REFERENCES `expresionlatina`.`nivel_clase_baile` (`idNivel_Clase_Baile`),
  CONSTRAINT `fk_Video_baile_Profesor1`
    FOREIGN KEY (`Profesor`)
    REFERENCES `expresionlatina`.`profesor` (`idProfesor`),
  CONSTRAINT `fk_Videos_baile_Genero_baile1`
    FOREIGN KEY (`Genero_baile`)
    REFERENCES `expresionlatina`.`genero_baile` (`idGenero_baile`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`acceso_a_video`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`acceso_a_video` (
  `Acceso` INT NOT NULL,
  `Video_baile` VARCHAR(45) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`Acceso`, `Video_baile`),
  INDEX `fk_Acceso_a_Video_Video_baile1_idx` (`Video_baile` ASC) VISIBLE,
  CONSTRAINT `fk_Acceso_a_Video_Acceso1`
    FOREIGN KEY (`Acceso`)
    REFERENCES `expresionlatina`.`acceso` (`idAcceso`),
  CONSTRAINT `fk_Acceso_a_Video_Video_baile1`
    FOREIGN KEY (`Video_baile`)
    REFERENCES `expresionlatina`.`video_baile` (`idVideo_baile`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`horario_dia`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`horario_dia` (
  `idHorario_dia` INT NOT NULL AUTO_INCREMENT,
  `dia` VARCHAR(12) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`idHorario_dia`),
  UNIQUE INDEX `dia_UNIQUE` (`dia` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`detalle_horario_dia`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`detalle_horario_dia` (
  `idDetalle_horario_dia` INT NOT NULL AUTO_INCREMENT,
  `detalle_horario_dia_inicio` VARCHAR(45) NOT NULL,
  `detalle_horario_dia_final` VARCHAR(45) NOT NULL,
  `Horario_dia` INT NOT NULL,
  `clase_baile_idClase_baile` INT NOT NULL,
  PRIMARY KEY (`idDetalle_horario_dia`, `Horario_dia`, `clase_baile_idClase_baile`),
  INDEX `fk_Detalle_horario_dia_Horario_dia1_idx` (`Horario_dia` ASC) VISIBLE,
  INDEX `fk_detalle_horario_dia_clase_baile1_idx` (`clase_baile_idClase_baile` ASC) VISIBLE,
  CONSTRAINT `fk_Detalle_horario_dia_Horario_dia1`
    FOREIGN KEY (`Horario_dia`)
    REFERENCES `expresionlatina`.`horario_dia` (`idHorario_dia`),
  CONSTRAINT `fk_detalle_horario_dia_clase_baile1`
    FOREIGN KEY (`clase_baile_idClase_baile`)
    REFERENCES `expresionlatina`.`clase_baile` (`idClase_baile`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`red_social`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`red_social` (
  `idRed_social` INT NOT NULL,
  `red_social` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idRed_social`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`profesor_has_red_social`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`profesor_has_red_social` (
  `Profesor` INT NOT NULL,
  `Red_social` INT NOT NULL,
  `link` VARCHAR(45) NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT '0',
  PRIMARY KEY (`Profesor`, `Red_social`),
  INDEX `fk_Profesor_has_Red_social_Red_social1_idx` (`Red_social` ASC) VISIBLE,
  INDEX `fk_Profesor_has_Red_social_Profesor1_idx` (`Profesor` ASC) VISIBLE,
  CONSTRAINT `fk_Profesor_has_Red_social_Profesor1`
    FOREIGN KEY (`Profesor`)
    REFERENCES `expresionlatina`.`profesor` (`idProfesor`),
  CONSTRAINT `fk_Profesor_has_Red_social_Red_social1`
    FOREIGN KEY (`Red_social`)
    REFERENCES `expresionlatina`.`red_social` (`idRed_social`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `expresionlatina`.`logro_profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`logro_profesor` (
  `idLogro_Profesor` INT NOT NULL AUTO_INCREMENT,
  `logro` VARCHAR(45) NOT NULL,
  `profesor_idProfesor` INT NOT NULL,
  PRIMARY KEY (`idLogro_Profesor`, `profesor_idProfesor`),
  INDEX `fk_Logro_Profesor_profesor1_idx` (`profesor_idProfesor` ASC) VISIBLE,
  CONSTRAINT `fk_Logro_Profesor_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `expresionlatina`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `expresionlatina`.`usuario_has_red_social`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`usuario_has_red_social` (
  `usuario_idUsuario` INT NOT NULL,
  `red_social_idRed_social` INT NOT NULL,
  `link` VARCHAR(45) NOT NULL,
  `estado` TINYINT NOT NULL,
  PRIMARY KEY (`usuario_idUsuario`, `red_social_idRed_social`),
  INDEX `fk_usuario_has_red_social_red_social1_idx` (`red_social_idRed_social` ASC) VISIBLE,
  CONSTRAINT `fk_usuario_has_red_social_usuario1`
    FOREIGN KEY (`usuario_idUsuario`)
    REFERENCES `expresionlatina`.`usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_usuario_has_red_social_red_social1`
    FOREIGN KEY (`red_social_idRed_social`)
    REFERENCES `expresionlatina`.`red_social` (`idRed_social`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `expresionlatina`.`Reseñas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`Reseñas` (
  `idReseñas` INT NOT NULL,
  `contenidoReseñas` VARCHAR(45) NOT NULL,
  `usuario_idUsuario` INT NOT NULL,
  PRIMARY KEY (`idReseñas`, `usuario_idUsuario`),
  INDEX `fk_Reseñas_usuario1_idx` (`usuario_idUsuario` ASC) VISIBLE,
  CONSTRAINT `fk_Reseñas_usuario1`
    FOREIGN KEY (`usuario_idUsuario`)
    REFERENCES `expresionlatina`.`usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `expresionlatina`.`Generos_Profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expresionlatina`.`Generos_Profesor` (
  `idProfesor` INT NOT NULL,
  `idGenero_baile` INT NOT NULL,
  PRIMARY KEY (`idProfesor`, `idGenero_baile`),
  INDEX `fk_Generos_Profesor_profesor1_idx` (`idProfesor` ASC) VISIBLE,
  CONSTRAINT `fk_Generos_Profesor_genero_baile1`
    FOREIGN KEY (`idGenero_baile`)
    REFERENCES `expresionlatina`.`genero_baile` (`idGenero_baile`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Generos_Profesor_profesor1`
    FOREIGN KEY (`idProfesor`)
    REFERENCES `expresionlatina`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('1', 'Administrador');
INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('2', 'Desarrollador');
INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('3', 'Profesor');
INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('4', 'Becado');
INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('5', 'Semi-Becado');
INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('6', 'Estudiante');
