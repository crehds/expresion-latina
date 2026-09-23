# Actualizar el contenido del sitio

Todo lo que se ve en el sitio —el horario, los estilos, los profesores, las
reseñas y los datos de contacto— sale de una sola planilla de Excel:
`content/horarios.xlsx`.

Para actualizar el sitio se reemplaza esa planilla. No hace falta instalar
nada ni saber programar: se hace desde el navegador.

## Cómo actualizar el sitio

### 1. Descarga la planilla

Entra a `content/horarios.xlsx` en GitHub y usa el botón **Download**.

Esa planilla ya trae cargado el contenido que está publicado hoy. No hay que
escribirlo de nuevo: solo se cambia lo que cambió.

> ¿Es la primera vez y quieres ver un ejemplo lleno? Descarga
> `content/ejemplo-completo.xlsx`. Trae las cinco hojas con todas sus columnas
> y algo escrito en cada una. **Las celdas pintadas de amarillo son las que
> todavía falta completar.**

### 2. Edita la planilla en Excel

Abajo está el detalle de qué va en cada hoja. Cuando termines, guarda el
archivo **con el mismo nombre**: `horarios.xlsx`.

### 3. Súbela a GitHub

En la carpeta `content` de GitHub, usa **Add file → Upload files** y arrastra
tu `horarios.xlsx`. Confirma el cambio.

Eso es todo. A partir de ahí el sitio se actualiza solo, en unos minutos.

> **Primero `develop`, después `main`.** Subir la planilla a la rama `develop`
> publica una versión para revisar. Cuando el resultado convence, se pasa a
> `main`, que es el sitio que ve el público.

---

## Qué va en cada hoja

### Hoja `Horario`

Una fila por clase. Si una clase deja de dictarse, se borra la fila.

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
distintos**. Si quedan en el mismo salón, se avisa y no se publica nada.

### Hoja `Generos`

Un género por fila. La columna `Tipo` distingue una **Clase** (aparece en la
página de clases, la gente se puede inscribir) de un **Ensayo** (ocupa el
horario pero no se ofrece como clase).

Para agregar un género nuevo, se agrega aquí primero y recién después se puede
usar en la hoja `Horario`.

`Descripcion` es la línea que describe el estilo en la página de clases.

### Hoja `Profesores`

Un profesor por fila. `Generos` acepta varios separados por coma.

**La foto se pega dentro de la planilla**, en la columna `Foto` de la fila de
ese profesor. Copias la imagen y la pegas ahí, como pegarías una foto en
cualquier documento. El sitio la toma de ahí.

Tres cosas que conviene saber sobre las fotos:

- Sirven **jpg y png**. Otros formatos se rechazan con un aviso.
- La foto queda **anclada a la fila** donde la pegas. Si la arrastras a otro
  lado, puede terminar asignada a otro profesor.
- Un profesor puede no tener foto: el sitio muestra sus iniciales. No es un
  error.

**Dejar la celda vacía no borra la foto.** Una celda `Foto` vacía significa
"esta planilla no dice nada sobre su foto", así que el profesor conserva la
que ya tenía. Es lo que permite actualizar el horario sin volver a pegar todas las
fotos cada vez.

Entonces:

| Quieres…                 | Qué haces                              |
| ------------------------ | -------------------------------------- |
| poner o cambiar una foto | pegas la nueva en su celda `Foto`      |
| dejar la que ya tiene    | no tocas la celda                      |
| que no tenga ninguna     | avisas a quien mantiene el repositorio |

Quitar una foto es el único caso que todavía no se puede hacer desde la
planilla.

`Nacimiento` acepta una fecha (`1994-06-12`) o solo el año (`1997`). De ahí
sale la edad que aparece en su ficha, así que no hay que actualizarla cada
año. Se puede dejar vacía.

### Hoja `Resenas`

Lo que dicen los alumnos. Una reseña por fila: quién la escribió, el texto, de
dónde salió (Google, Facebook, Instagram) y el enlace.

Si la hoja está vacía, el sitio simplemente no muestra esa sección.

### Hoja `Estudio`

Dirección, WhatsApp, email y redes. Se completa la columna `Valor`.

El WhatsApp se puede escribir con código de país (`+51 960 507 583`) o sin él
(`960 507 583`): si es un celular peruano, se le agrega el `+51` solo.

---

## Cuando algo sale mal

Si la planilla tiene un problema, **no se publica nada**. El sitio nunca queda
a medias: o entra la planilla entera, o no entra ninguna parte.

Para ver qué pasó, entra a la pestaña **Actions** de GitHub y abre la última
corrida. Ahí aparece una tabla que dice exactamente qué celda revisar:

```
El archivo tiene 2 problema(s). No se cambió nada.

  HOJA        FILA   COLUMNA  DETALLE
  ----------  -----  -------  -------
  Horario     7      Genero   "Salza" no está en la hoja Generos.
  Profesores  10     Foto     La foto pegada tiene un formato que no se puede usar (.bmp). Usa jpg, jpeg o png.
```

Se corrigen esas celdas y se vuelve a subir el archivo. El proceso se repite
solo.

---

## Para quien trabaja con el repositorio

La planilla también se puede importar desde la terminal, sin pasar por GitHub.

Revisar sin tocar nada:

```bash
npm run data:import -- content/horarios.xlsx --dry-run
```

Aplicar de verdad:

```bash
npm run data:import -- content/horarios.xlsx
```

Regenerar el ejemplo lleno a partir del contenido publicado:

```bash
node scripts/data/make-example.mjs content/ejemplo-completo.xlsx
```

Generar una planilla en blanco con el contenido actual:

```bash
npm run data:template -- <destino.xlsx>
```

> **Cuidado con el destino.** Sin argumento, ese último comando escribe en
> `content/horarios.xlsx` y pisa la planilla real. Indica siempre un archivo
> de salida.

---

## Preguntas frecuentes

**¿Se pierden los videos al importar?**
No. La planilla no maneja los videos de la academia, así que se conservan los
que ya estaban.

**¿Y si borro una hoja entera de la planilla?**
No se borra ese contenido del sitio. Una hoja que no está se interpreta como
"esta planilla no dice nada al respecto", y se conserva lo publicado. Para
vaciar algo hay que dejar la hoja presente y sin filas.

**¿Puedo borrar la planilla después de subirla?**
No. `content/horarios.xlsx` vive en el repositorio y es de donde sale el
contenido: es el archivo que se reemplaza para actualizar. Cualquier otra
planilla que uses para trabajar sí queda fuera.

**¿Y si el archivo está abierto en Excel?**
El comando no va a poder leerlo. Ciérralo y vuelve a intentar.
