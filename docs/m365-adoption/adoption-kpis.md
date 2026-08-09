KPI de adopción recomendados

Objetivos: medir el uso, la colaboración, la calidad de la información y la eficiencia de procesos.

Categorías y métricas (ejemplos)

1) Uso y alcance
- Teams activos: número de Teams con actividad en los últimos 30 días
- Usuarios activos: usuarios únicos con actividad en Teams (mensajes, llamadas, archivos)
- % de usuarios con cuenta y acceso configurado

2) Colaboración
- Mensajes por usuario por semana
- Reuniones con uso de Teams (número, duración, asistentes)
- Documentos compartidos/colaborados (document co-authoring events)

3) Gobernanza y calidad
- Equipos sin Owner
- Equipos inactivos >90 días
- Documentos sin metadata obligatoria
- Número de breaches detectados por DLP (si aplica)

4) Automatización
- Flujos de Power Automate activos
- Flujos que fallan (errores) por periodo
- Automatizaciones que redujeron tiempo de proceso (medir en casos)

5) Adopción de herramientas de reporting
- Dashboards creados y consumidos (Power BI)
- Usuarios con permiso de consumo y creación

Metas iniciales (ejemplo 90 días)
- 70% de usuarios activos semanalmente
- 80% de equipos con Owner asignado
- Reducir tickets manuales en procesos target en 30% vía automatización

Recolección y frecuencia
- Recolección diaria desde servicios (Graph API, Power BI datasets)
- Reporting semanal y dashboard actualizado diariamente

Notas técnicas
- Usar Microsoft Graph Reports y Usage APIs para datos de Teams
- Combinar logs de SharePoint, Planner y Power Automate para métricas cruzadas
- Agregar dimensiones: unidad de negocio, región, etiqueta de sensibilidad

Definir responsables para cada KPI y aceptación de metas.