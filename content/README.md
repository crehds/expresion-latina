# Actualizar el horario del sitio

El contenido del sitio (horario, géneros, profesores y datos de contacto) sale
de una planilla de Excel. Editás la planilla, corrés un comando y el sitio
queda actualizado.

## Paso 1 — Generar la planilla

```bash
npm run data:template -- content/horarios.xlsx
```

La planilla **ya viene con el horario actual cargado**. No hay que escribirlo
de nuevo: se edita lo que cambió.

## Paso 2 — Editar

La planilla tiene cuatro hojas. Lo habitual es tocar solo la primera.

### Hoja `Horario`

Una fila por clase. Si una clase no se dicta, se borra la fila.

| Columna    | Qué va                                 | ¿Obligatorio? |
| ---------- | -------------------------------------- | ------------- |
| `Dia`      | Lunes a Domingo (lista desplegable)    | Sí            |
| `Inicio`   | Hora de inicio, por ejemplo `19:00`    | Sí            |
| `Fin`      | Hora de fin, por ejemplo `20:30`       | Sí            |
| `Genero`   | Género de la clase (lista desplegable) | Sí            |
| `Profesor` | Quién la dicta (lista desplegable)     | No            |
| `Nivel`    | Principiantes, Básico, Intermedio…     | No            |
| `Salon`    | Si se deja vacío, queda como `Sala 1`  | No            |
| `Nota`     | Texto corto, como `Pack Noches`        | No            |

Las columnas con lista desplegable **solo aceptan las opciones de la lista**.
Eso evita el error más común: escribir un nombre con una letra distinta a como
figura en las otras hojas.

Dos clases pueden ir a la misma hora el mismo día **si están en salones
distintos**. Si quedan en el mismo salón, el comando lo avisa.

### Hoja `Generos`

Un género por fila. La columna `Tipo` distingue una **Clase** (aparece en la
página de clases, la gente se puede inscribir) de un **Ensayo** (ocupa el
horario pero no se ofrece como clase).

Para agregar un género nuevo, se agrega acá primero y recién después se puede
usar en la hoja `Horario`.

### Hoja `Profesores`

Un profesor por fila. `Generos` acepta varios separados por coma.

`Imagen` es el nombre del archivo de la foto y **puede quedar vacío**: si no
hay foto, el sitio muestra las iniciales. Para agregar una foto hay que pasarle
el archivo a quien mantiene el sitio.

### Hoja `Estudio`

Dirección, WhatsApp, email y redes. Se completa la columna `Valor`.

## Paso 3 — Revisar antes de aplicar

```bash
npm run data:import -- content/horarios.xlsx --dry-run
```

Revisa la planilla y muestra el resumen **sin cambiar nada**. Conviene hacer
esto siempre primero.

Si algo está mal, aparece una tabla indicando hoja, fila y columna:

```
El archivo tiene 2 problema(s). No se cambió nada.

  HOJA     FILA   COLUMNA  DETALLE
  -------  -----  -------  -------
  Horario  7      Genero   "Salza" no está en la hoja Generos.
  Horario  12     Fin      La clase termina a las 19:00, que no es después de las 20:00.
```

**Mientras haya un solo problema, no se escribe nada.** El sitio nunca queda a
medias: o entra la planilla entera, o no entra nada.

## Paso 4 — Aplicar

```bash
npm run data:import -- content/horarios.xlsx
```

## Paso 5 — Publicar

```bash
git diff src/data/academy.json
```

Si el cambio es el esperado, se sube al repositorio y el sitio se publica solo.

## Preguntas frecuentes

**¿Se pierden los videos al importar?**
No. La planilla no maneja videos, así que el comando conserva los que ya
estaban.

**¿Puedo borrar la planilla después?**
Sí. La versión que vale es `src/data/academy.json`, que queda en el
repositorio. La planilla se puede volver a generar cuando haga falta.

**¿Y si el archivo está abierto en Excel?**
El comando no va a poder leerlo. Cerralo y volvé a intentar.
