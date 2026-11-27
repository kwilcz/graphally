// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The laid-out page becomes the figure, stage by stage. The order is the figure's: each stage
// reads what the ones before it left, and the problems come out in this order.
import { createScriptApi, runDrawingScripts } from '../script/script-api.js';
import { createGeometry } from '../script/geometry.js';
import { addConnectionsData } from '../script/connections-data.js';
import { walkPage } from '../walk/walk.js';
import { routeConnections, exposeRoutes } from '../connect/connectors.js';
import { checkLines } from '../checks/lines.js';
import { checkBoxes, checkPageWidth } from '../checks/boxes.js';
import { checkTakenClasses } from '../checks/taken-classes.js';
import { createFigure, measurePage } from './figure.js';
import { resolvePageIcons } from './page-icons.js';
import { pageSize } from './page-size.js';
import { createMarkers } from './markers.js';
import { stepTimes } from './motion.js';
import { drawRoutes } from './draw-routes.js';
import { drawMarks } from './draw-marks.js';
import { assembleSvg } from './assemble.js';

export function buildFigure(setup) {
  const figure = createFigure(setup);
  checkTakenClasses(figure);
  // Icon sizes change the layout, so the page is measured after them.
  resolvePageIcons(figure);
  measurePage(figure);
  // The script runs on the measured page: its connections and drawings, then those given as data.
  const geometry = createGeometry(figure), api = createScriptApi(figure, geometry);
  runDrawingScripts(figure, api, setup.scripts);
  addConnectionsData(figure, api, geometry, setup.connections);
  walkPage(figure);
  const size = pageSize(figure);
  const routes = routeConnections(figure, size);
  checkLines(figure, routes);
  checkPageWidth(figure, size);
  if (figure.options.debug) exposeRoutes(routes);
  const markers = createMarkers(figure.id), steps = stepTimes(figure.steps);
  const lines = drawRoutes(figure, routes, markers, steps);
  const marks = drawMarks(figure, markers);
  checkBoxes(figure);
  return assembleSvg(figure, { routes, lines, marks, markers, steps, size });
}
