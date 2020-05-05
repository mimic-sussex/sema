/////////////////////////////////////
/// Stand alone lalolib base functions
////////////////////////////////////
var printPrecision = 3; // number of digits to print

var LALOLibPlotsIndex = 0;
var LALOLibPlots = new Array();
var LALOLABPLOTMOVING = false;

//////////////////////////
//// Cross-browser compatibility
///////////////////////////

if( typeof(console) == "undefined" ) {
	// for Safari
	var console = {log: function ( ) { } };
}

if( typeof(Math.sign) == "undefined" ) {
	// for IE, Safari
	Math.sign = function ( x ) { return ( x>=0 ? (x==0 ? 0 : 1) : -1 ) ;}
}

//////////////////////////
//// printing
///////////////////////////

function laloprint( x , htmlId, append ) {
	/*
		use print(x) to print to the standard LALOLabOutput

		use print(x, id) to print to another html entity
		
		use str = print(x, true) to get the resulting string
	*/
	
	if ( typeof(htmlId) == "undefined" )
		var htmlId = "LALOLibOutput"; 
	if ( typeof(append) == "undefined" )
		var append = true; 
				
	return printMat(x, size(x), htmlId, append ) ;
}

function printMat(A, size, htmlId, append) {
	if (typeof(append) === "undefined")
		var append = false;
	if ( typeof(htmlId) == "undefined" || htmlId === true ) {
		// return a string as [ [ .. , .. ] , [.. , ..] ]
		if ( type(A) == "matrix" ) {
			var str = "[";
			var i;
			var j;
			var m = size[0];
			var n = size[1];

			for (i=0;i<m; i++) {
				str += "[";
				for ( j=0; j< n-1; j++)
					str += printNumber(A.val[i*A.n+j]) + ",";
				if ( i < m-1)
					str += printNumber(A.val[i*A.n+j]) + "]; ";
				else
					str += printNumber(A.val[i*A.n+j]) + "]";
			}			
			str += "]";
			return str;
		}
		else if (type(A) == "vector" ) {
			var n = A.length;
			var str = "";
			// Vector (one column)
			for (var i=0;i<n; i++) {
				str += "[ " + printNumber(A[i]) + " ]<br>";
			}
			console.log(str);
			return str;
		}
	}
	else {
		// Produce HTML code and load it in htmlId
		
		var html = "";
		var i;
		var j;
		
		/*if (domathjax) {
			html = tex ( A ) ;
		}
		else {*/
			if ( isScalar(A) ) {
				html +=  A + "<br>" ;
			}
			else if (type(A) == "vector" ) {
				var n = size[0];

				// Vector (one column)
				for (i=0;i<n; i++) {
					html += "[ " + printNumber(A[i]) + " ]<br>";
				}
			}
			else {
				// Matrix
				var m = size[0];
				var n = size[1];

				for (i=0;i<m; i++) {
					html += "[ ";
					for(j=0;j < n - 1; j++) {
						html += printNumber(A.val[i*A.n+j]) + ", ";
					}
					html += printNumber(A.val[i*A.n+j]) + " ]<br>";
				}
			}
		//}
		if (append)
			document.getElementById(htmlId).innerHTML += html;
		else
			document.getElementById(htmlId).innerHTML = html;
		/*
		if ( domathjax) 
			MathJax.Hub.Queue(["Typeset",MathJax.Hub,"output"]);			
			*/
	}
}

function printNumber ( x ) {
	switch ( typeof(x) ) {
		case "undefined":
			return "" + 0;// for sparse matrices
			break;
		case "string":
			/*if ( domathjax ) 
				return "\\verb&" + x + "&";
			else*/
				return x;
			break;
		case "boolean":
			return x;
			break;
		default:	
			if ( x == Infinity )
				return "Inf";
			if ( x == -Infinity )
				return "-Inf";
			var x_int = Math.floor(x);
			if ( Math.abs( x - x_int ) < 2.23e-16 ) {
				return "" + x_int;
			} 
			else
				return x.toFixed( printPrecision );
				
			break;
	}
}

//// Error handling

function error( msg ) {
	throw new Error ( msg ) ;	
//	postMessage( {"error": msg} );
}


/////////// 
// Plots
//////////
function plot(multiargs) {
	// plot(x,y,"style", x2,y2,"style",y3,"style",... )
	
	// Part copied from lalolabworker.js
	
	var data = new Array();
	var styles = new Array();	
	var legends = new Array();		
	var minX = Infinity;
	var maxX = -Infinity;
	var minY = Infinity;
	var maxY = -Infinity;
	
	var p=0; // argument pointer
	var x;
	var y;
	var style;
	var i;
	var n;
	var c = 0; // index of current curve
	while ( p < arguments.length)  {
	
		if ( type( arguments[p] ) == "vector" ) {

			if ( p + 1 < arguments.length && type ( arguments[p+1] ) == "vector" ) {
				// classic (x,y) arguments
				x = arguments[p];
				y = arguments[p+1];
			
				p++;
			}
			else {
				// only y provided => x = 0:n
				y = arguments[p];
				x = range(y.length);
			}
		}
		else if ( type( arguments[p] ) == "matrix" ) {
			// argument = [x, y]
			if ( arguments[p].n == 1 ) {
				y = arguments[p].val;
				x = range(y.length);
			}
			else if (arguments[p].m == 1 ) {
				y = arguments[p].val;
				x = range(y.length);
			}
			else if ( arguments[p].n == 2 ) {
				// 2 columns => [x,y]
				x = getCols(arguments[p], [0]);
				y = getCols(arguments[p], [1]);
			}			
			else {
				// more columns => trajectories as rows
				x = range(arguments[p].n);
				for ( var row = 0; row < arguments[p].m; row++) {
					y = arguments[p].row(row);
					data[c] = [new Array(x.length), new Array(x.length)];
					for ( i=0; i < x.length; i++) {
						data[c][0][i] = x[i];
						data[c][1][i] = y[i]; 
						if ( x[i] < minX )
							minX = x[i];
						if(x[i] > maxX ) 
							maxX = x[i];
						if ( y[i] > maxY ) 
							maxY = y[i];
						if ( y[i] < minY ) 
							minY = y[i];

					}
		
					styles[c] = undefined;
					legends[c] = "";
		
					// Next curve
					c++; 
				}
				p++;
				continue;
			}
		}
		else {
			return "undefined";
		}
				
		//Style
		style = undefined;
		if ( p + 1 < arguments.length && type ( arguments[p+1] ) == "string" ) {
			style = arguments[p+1];
			p++;
		}			
		legend = "";	
		if ( p + 1 < arguments.length && type ( arguments[p+1] ) == "string" ) {
			legend = arguments[p+1];
			p++;
		}	

		// Add the curve (x,y, style) to plot		
		data[c] = [new Array(x.length), new Array(x.length)];		
		for ( i=0; i < x.length; i++) {
			data[c][0][i] = x[i];
			data[c][1][i] = y[i]; 
			if ( x[i] < minX )
				minX = x[i];
			if(x[i] > maxX ) 
				maxX = x[i];
			if ( y[i] > maxY ) 
				maxY = y[i];
			if ( y[i] < minY ) 
				minY = y[i];

		}
		styles[c] = style;
		legends[c] = legend;
		
		// Next curve
		c++; 
		p++; // from next argument	
	}	
		
	var widthX = maxX-minX;
	var widthY = Math.max( maxY-minY, 1);

	maxX += 0.1*widthX;
	minX -= 0.1*widthX;
	maxY += 0.1*widthY;
	minY -= 0.1*widthY;
	
	if ( minY > 0 ) 
		minY = -0.1*maxY;
	
	if ( maxY < 0 ) 
		maxY = -0.1*minY;
	
	var scaleY = 0.9 * (maxX-minX) / (2*maxY);

	var plotinfo = {"data" : data, "minX" : minX, "maxX" : maxX, "minY" : minY, "maxY": maxY, "styles" : styles, "legend": legends };

	//////// Part from laloplots.html //////////
	
	var plotid = "LALOLibPlot" + LALOLibPlotsIndex;
	var legendwidth = 50;
	
	LALOLibOutput.innerHTML += "<br><div style='position:relative;left:0px;top:0px;text-align:left;'> <div><a onmousemove='mouseposition(event," + LALOLibPlotsIndex + ");' onmousedown='mousestartmove(event," + LALOLibPlotsIndex + ");' onmouseup='mousestopmove(event);' onmouseleave='mousestopmove(event);' ondblclick='zoomoriginal(" + LALOLibPlotsIndex + ");'><canvas id='" +plotid + "'  width='500' height='500' style='border: 1px solid black;'></canvas></a></div> <label id='lblposition" + LALOLibPlotsIndex + "'></label> <div style='position: absolute;left: 550px;top: -1em;'> <canvas id='legend" + LALOLibPlotsIndex + "' width='" + legendwidth + "' height='500'></canvas></div> <div id='legendtxt" + LALOLibPlotsIndex + "' style='position: absolute;left: 610px;top: 0;'></div> </div>";

	// prepare legend
	var ylegend = 20;
	
	// do plot

	LALOLibPlots[LALOLibPlotsIndex] = new Plot(plotid) ;
		
	LALOLibPlots[LALOLibPlotsIndex].setScalePlot(plotinfo.minX, plotinfo.maxX, 200, plotinfo.scaleY); 
	if ( plotinfo.minY && plotinfo.maxY ) {
		LALOLibPlots[LALOLibPlotsIndex].view(plotinfo.minX, plotinfo.maxX, plotinfo.minY, plotinfo.maxY); 
	}
	
	var colors = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0];
	
	var p;
	var color;
	for (p = 0; p<plotinfo.data.length; p++) {
		
		var linestyle = true;
		var pointstyle = true;
		if ( typeof(plotinfo.styles[p]) == "string" ) {
			if ( plotinfo.styles[p].indexOf(".") >= 0 ) {
				linestyle = false;
				plotinfo.styles[p] = plotinfo.styles[p].replace(".","");
			}
			if ( plotinfo.styles[p].indexOf("_") >= 0 ) {
				pointstyle = false;
				plotinfo.styles[p] = plotinfo.styles[p].replace("_","");
			}
			color = parseColor(plotinfo.styles[p]);
		
			if ( color < 0 )
				color = colors.splice(0,1)[0];		// pick next unused color
			else
				colors.splice(colors.indexOf(color),1); // remove this color
		}
		else 
			color = color = colors.splice(0,1)[0];	// pick next unused color
		
		if ( typeof(color) == "undefined")	// pick black if no next unused color
			color = 0;
	
		for ( i=0; i < plotinfo.data[p][0].length; i++) {
			if ( pointstyle )
				LALOLibPlots[LALOLibPlotsIndex].addPoint(plotinfo.data[p][0][i],plotinfo.data[p][1][i], color);	
			if ( linestyle && i < plotinfo.data[p][0].length-1 ) 
				LALOLibPlots[LALOLibPlotsIndex].plot_line(plotinfo.data[p][0][i],plotinfo.data[p][1][i], plotinfo.data[p][0][i+1],plotinfo.data[p][1][i+1], color);				
		}
		
		
		// Legend
		if ( plotinfo.legend[p] != "" ) {		
			var ctx = document.getElementById("legend" +LALOLibPlotsIndex).getContext("2d");
			setcolor(ctx, color);
			ctx.lineWidth = "3";
			if ( pointstyle ) {
				ctx.beginPath();
				ctx.arc( legendwidth/2 , ylegend, 5, 0, 2 * Math.PI , true);
				ctx.closePath();
				ctx.fill();
			}
			if( linestyle) {
				ctx.beginPath();
				ctx.moveTo ( 0,ylegend);
				ctx.lineTo (legendwidth, ylegend);
				ctx.stroke();
			}
			ylegend += 20;
			
			document.getElementById("legendtxt" +LALOLibPlotsIndex).innerHTML += plotinfo.legend[p] + "<br>";						
		}
	}
	for ( var pi=0; pi <= LALOLibPlotsIndex; pi++)
		LALOLibPlots[pi].replot();
	
	// ZOOM	
	if(window.addEventListener)
        document.getElementById(plotid).addEventListener('DOMMouseScroll', this.mousezoom, false);//firefox
 
    //for IE/OPERA etc
    document.getElementById(plotid).onmousewheel = this.mousezoom;
	
	LALOLibPlotsIndex++;
}

// Color plot
function colorplot(multiargs) {
	// colorplot(x,y,z) or colorplot(X) or colorplot(..., "cmapname" )

	// Part copied from lalolabworker.js
	
	var minX = Infinity;
	var maxX = -Infinity;
	var minY = Infinity;
	var maxY = -Infinity;
	var minZ = Infinity;
	var maxZ = -Infinity;
	
	var x;
	var y;
	var z;
	var i;

	var t0 =  type( arguments[0] );
	if ( t0 == "matrix" && arguments[0].n == 3 ) {
		x = getCols(arguments[0], [0]);
		y = getCols(arguments[0], [1]);
		z = getCols(arguments[0], [2]);
	}
	else if ( t0 == "matrix" && arguments[0].n == 2 && type(arguments[1]) == "vector" ) {
		x = getCols(arguments[0], [0]);
		y = getCols(arguments[0], [1]);
		z = arguments[1];
	}
	else if (t0 == "vector" && type(arguments[1]) == "vector" && type(arguments[2]) == "vector") {
		x = arguments[0];
		y = arguments[1];
		z = arguments[2];
	}
	else {
		return "undefined";
	}
	
	var minX = min(x);
	var maxX = max(x);
	var minY = min(y);
	var maxY = max(y);
	var minZ = min(z);
	var maxZ = max(z);
	
	var widthX = maxX-minX;
	var widthY = Math.max( maxY-minY, 1);

	maxX += 0.1*widthX;
	minX -= 0.1*widthX;
	maxY += 0.1*widthY;
	minY -= 0.1*widthY;
	
	if ( minY > 0 ) 
		minY = -0.1*maxY;
	
	if ( maxY < 0 ) 
		maxY = -0.1*minY;

	var plotinfo = {"x" : x, "y": y, "z": z, "minX" : minX, "maxX" : maxX, "minY" : minY, "maxY": maxY,  "minZ" : minZ, "maxZ" : maxZ };

	//////// Part from laloplots.html //////////
		
	var plotid = "LALOLibPlot" + LALOLibPlotsIndex;
	var legendwidth = 50;
	
	
	LALOLibOutput.innerHTML += "<br><div style='position:relative;left:0px;top:0px;text-align:left;'> <div><a onmousemove='mouseposition(event," + LALOLibPlotsIndex + ");' onmousedown='mousestartmove(event," + LALOLibPlotsIndex + ");' onmouseup='mousestopmove(event);' onmouseleave='mousestopmove(event);' ondblclick='zoomoriginal(" + LALOLibPlotsIndex + ");'><canvas id='" +plotid + "'  width='500' height='500' style='border: 1px solid black;'></canvas></a></div> <label id='lblposition" + LALOLibPlotsIndex + "'></label> <div style='position: absolute;left: 550px;top: -1em;'><label id='legendmaxZ" + LALOLibPlotsIndex + "' style='font-family:verdana;font-size:80%;'></label><br>  <canvas id='legend" + LALOLibPlotsIndex + "' width='" + legendwidth + "' height='500'></canvas><br><label id='legendminZ" + LALOLibPlotsIndex + "' style='font-family:verdana;font-size:80%;'></label></div> <div id='legendtxt" + LALOLibPlotsIndex + "' style='position: absolute;left: 610px;top: 0;'></div> </div>";
	
	LALOLibPlots[LALOLibPlotsIndex] = new ColorPlot(plotid) ;
	LALOLibPlots[LALOLibPlotsIndex].setScale(plotinfo.minX, plotinfo.maxX, plotinfo.minY, plotinfo.maxY,plotinfo.minZ, plotinfo.maxZ); 
	LALOLibPlots[LALOLibPlotsIndex].view(plotinfo.minX, plotinfo.maxX, plotinfo.minY, plotinfo.maxY); 	
	
	for (var i=0; i < plotinfo.x.length; i++)
		LALOLibPlots[LALOLibPlotsIndex].addPoint(plotinfo.x[i],plotinfo.y[i],plotinfo.z[i]);
	
	LALOLibPlots[LALOLibPlotsIndex].replot();
	
	var legendwidth = 50;
//	plotlegend.innerHTML += plotinfo.maxZ.toFixed(3) + "<br><canvas id='legend'  width='" + legendwidth + "' height='500'></canvas><br>" + plotinfo.minZ.toFixed(3);
	var ctx = document.getElementById("legend" +LALOLibPlotsIndex).getContext("2d");

	var legendcanvas = document.getElementById("legend"+LALOLibPlotsIndex);
	if ( legendcanvas )
		var legendheight = legendcanvas.height;
	else
		var legendheight = 500;

	var y;
	for (var i=0; i< LALOLibPlots[LALOLibPlotsIndex].cmap.length;i++) {
		y = Math.floor(i * legendheight / LALOLibPlots[LALOLibPlotsIndex].cmap.length);
		ctx.fillStyle = "rgb(" + LALOLibPlots[LALOLibPlotsIndex].cmap[i][0] + "," + LALOLibPlots[LALOLibPlotsIndex].cmap[i][1] + "," + LALOLibPlots[LALOLibPlotsIndex].cmap[i][2] + ")";
		ctx.fillRect( 0, legendheight-y, legendwidth , (legendheight / LALOLibPlots[LALOLibPlotsIndex].cmap.length) + 1) ;
	}	
	
	document.getElementById("legendmaxZ" + LALOLibPlotsIndex).innerHTML = plotinfo.maxZ.toPrecision(3);
	document.getElementById("legendminZ" + LALOLibPlotsIndex).innerHTML = plotinfo.minZ.toPrecision(3);
		
	if(window.addEventListener)
        document.getElementById(plotid).addEventListener('DOMMouseScroll', this.mousezoom, false);//firefox
 
    //for IE/OPERA etc
    document.getElementById(plotid).onmousewheel = this.mousezoom;
	
	LALOLibPlotsIndex++;
}

// 3D plot
function plot3(multiargs) {
	// plot3(x,y,z,"style", x2,y2,z2,"style",... )
	
	var data = new Array();
	var styles = new Array();	
	var legends = new Array();		
	
	var p=0; // argument pointer
	var x;
	var y;
	var z;
	var style;
	var i;
	var n;
	var c = 0; // index of current curve
	while ( p < arguments.length)  {
	
		if ( type( arguments[p] ) == "vector" ) {

			if ( p + 2 < arguments.length && type ( arguments[p+1] ) == "vector" && type ( arguments[p+2] ) == "vector" ) {
				// classic (x,y,z) arguments
				x = arguments[p];
				y = arguments[p+1];
				z = arguments[p+2];				
				
				p += 2;
			}
			else {
				return "undefined";
			}
		}
		else if ( type( arguments[p] ) == "matrix" ) {
			// argument = [x, y, z]
			n = arguments[p].length;
			x = new Array(n);
			y = new Array(n);
			z = new Array(n);
			for ( i=0; i < n; i++) {
				x[i] = get(arguments[p], i, 0); 
				y[i] = get(arguments[p], i, 1);				
				z[i] = get(arguments[p], i, 2);					
			}
		}
		else {
			return "undefined";
		}
				
		//Style
		style = undefined;
		if ( p + 1 < arguments.length && type ( arguments[p+1] ) == "string" ) {
			style = arguments[p+1];
			p++;
		}			
		legend = "";	
		if ( p + 1 < arguments.length && type ( arguments[p+1] ) == "string" ) {
			legend = arguments[p+1];
			p++;
		}	

		// Add the curve (x,y,z, style) to plot
		data[c] = new Array();
		for ( i=0; i < x.length; i++) {
			data[c][i] = [x[i], y[i], z[i]]; 			
		}
		styles[c] = style;
		legends[c] = legend;
		
		// Next curve
		c++; 
		p++; // from next argument	
				
	}	
			

	var plotinfo =  { "data" : data, "styles" : styles, "legend": legends };
	
	//////// Part from laloplots.html //////////
	
	var plotid = "LALOLibPlot" + LALOLibPlotsIndex;
	var legendwidth = 50;
	
	LALOLibOutput.innerHTML += '<br><div style="position:relative;left:0px;top:0px;text-align:left;"> <div><a onmousedown="LALOLibPlots[' + LALOLibPlotsIndex + '].mousedown(event);" onmouseup="LALOLibPlots[' + LALOLibPlotsIndex + '].mouseup(event);" onmousemove="LALOLibPlots[' + LALOLibPlotsIndex + '].mouserotation(event);"><canvas id="' + plotid + '" width="500" height="500" style="border: 1px solid black;" title="Hold down the mouse button to change the view and use the mousewheel to zoom in or out." ></canvas></a></div><label id="lblposition' + LALOLibPlotsIndex + '"></label> <div style="position: absolute;left: 550px;top: -1em;"> <canvas id="legend' + LALOLibPlotsIndex + '" width="' + legendwidth + '" height="500"></canvas></div> <div id="legendtxt' + LALOLibPlotsIndex + '" style="position: absolute;left: 610px;top: 0;"></div> </div>';
	
	var ylegend = 20;
	
	// do plot

	LALOLibPlots[LALOLibPlotsIndex] = new Plot3D(plotid) ;
	
	LALOLibPlots[LALOLibPlotsIndex].cameraDistance = 30; 
	LALOLibPlots[LALOLibPlotsIndex].angleX = Math.PI/10;	
	LALOLibPlots[LALOLibPlotsIndex].angleZ = Math.PI/10;
	
	LALOLibPlots[LALOLibPlotsIndex].axisNameX1 = "x";
	LALOLibPlots[LALOLibPlotsIndex].axisNameX2 = "y";		
	LALOLibPlots[LALOLibPlotsIndex].axisNameX3 = "z";		
		
	
	var colors = [1,2,3,4,5,0];
	
	var p;
	var color;

	for (p = 0; p<plotinfo.data.length; p++) {
		
		var linestyle = false;
		var pointstyle = true;
		if ( typeof(plotinfo.styles[p]) == "string" ) {
			if ( plotinfo.styles[p].indexOf(".") >= 0 ) {
				linestyle = false;
				plotinfo.styles[p] = plotinfo.styles[p].replace(".","");
			}
			if ( plotinfo.styles[p].indexOf("_") >= 0 ) {
				pointstyle = false;
				plotinfo.styles[p] = plotinfo.styles[p].replace("_","");
			}
			color = parseColor(plotinfo.styles[p]);
		
			if ( color < 0 )
				color = colors.splice(0,1)[0];		// pick next unused color
			else
				colors.splice(colors.indexOf(color),1); // remove this color
		}
		else 
			color = color = colors.splice(0,1)[0];	// pick next unused color
		
		if ( typeof(color) == "undefined")	// pick black if no next unused color
			color = 0;
	
		for ( i=0; i < plotinfo.data[p].length; i++) {
			if ( pointstyle ) {
				LALOLibPlots[LALOLibPlotsIndex].X.push( plotinfo.data[p][i] );
				LALOLibPlots[LALOLibPlotsIndex].Y.push( color );	
			}
			if ( linestyle && i < plotinfo.data[p].length-1 ) 
				LALOLibPlots[LALOLibPlotsIndex].plot_line(plotinfo.data[p][i], plotinfo.data[p][i+1], "", color);
		}
		
		// Legend
		if ( plotinfo.legend[p] != "" ) {		
			var ctx = document.getElementById("legend" +LALOLibPlotsIndex).getContext("2d");
			setcolor(ctx, color);
			ctx.lineWidth = "3";
			if ( pointstyle ) {
				ctx.beginPath();
				ctx.arc( legendwidth/2 , ylegend, 5, 0, 2 * Math.PI , true);
				ctx.closePath();
				ctx.fill();
			}
			if( linestyle) {
				ctx.beginPath();
				ctx.moveTo ( 0,ylegend);
				ctx.lineTo (legendwidth, ylegend);
				ctx.stroke();
			}
			ylegend += 20;
			
			document.getElementById("legendtxt" +LALOLibPlotsIndex).innerHTML += plotinfo.legend[p] + "<br>";						
		}
	}
	LALOLibPlots[LALOLibPlotsIndex].computeRanges();
	LALOLibPlots[LALOLibPlotsIndex].replot();

	LALOLibPlotsIndex++;
}

// image
function image(X, title) {
	if (type(X) == "vector")  {
		X = mat([X]);
	}
		
	var style;
	var minX = min(X);
	var maxX = max(X);
	var m = X.length;	
	var n = X.n;
	var scale = (maxX - minX) ; 
	
	var i;
	var j;
	var k = 0;
	var data = new Array();
	for ( i=0; i < m; i++) {
		var Xi = X.row(i);
		for ( j=0; j < n; j++) {	// could do for j in X[i] if colormap for 0 is white...
			color =   mul( ( Xi[j] - minX) / scale, ones(3) ) ;
			data[k] = [i/m, j/n, color];
			k++;
		}
	}
	style  = [m,n,minX,maxX];

	var imagedata =  { "data" : data, "style" : style, "title": title };

	////// Part from laloplots.html	
	
	
	var plotid = "LALOLibPlot" + LALOLibPlotsIndex;
	var legendwidth = 50;
	var pixWidth ;
	var pixHeight ;

		// prepare legend
	var ylegend = 20;
	
	// do plot

	
	var i;

	var width = 500; 
	var height = 500; 	

	var title = imagedata.title;
	if(title) {
		LALOLibOutput.innerHTML += "<h3>"+title+"</h3>" + "  ( " + imagedata.style[0] + " by " + imagedata.style[1] + " matrix )";
	}
	
	if ( imagedata.style[1] > width ) {
		width = imagedata.style[1]; 
		plotlegend.style.left = (width+60) +"px";
	}
	if ( imagedata.style[0] > height )
	 	height = imagedata.style[0];
		
	pixWidth = width / imagedata.style[1];
	pixHeight = height / imagedata.style[0];
	
	var legendwidth = 50;
	
	LALOLibOutput.innerHTML += '<div style="position:relative;left:0px;top:0px;text-align:left;"> <div><a onmousemove="mouseimageposition(event,' + LALOLibPlotsIndex + ');"><canvas id="' +plotid + '"  width="' + width + '" height="' + height + '" style="border: 1px solid black;"></canvas></a></div><label id="lblposition' + LALOLibPlotsIndex + '"></label> <div style="position: absolute;left: 550px;top: -1em;">' + imagedata.style[2].toFixed(3) + '<br> <canvas id="legend' + LALOLibPlotsIndex + '" width="' + legendwidth + '" height="500"></canvas> <br>' + imagedata.style[3].toFixed(3) + ' </div>  </div>';

	var x;
	var y;
	var color;
	
	LALOLibPlots[LALOLibPlotsIndex] = imagedata;
	LALOLibPlots[LALOLibPlotsIndex].canvasId = plotid; 
	var canvas = document.getElementById(plotid);
	
  	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");

		for ( i=0; i < imagedata.data.length ; i++) {
			x = canvas.width * LALOLibPlots[LALOLibPlotsIndex].data[i][1];
			y =  canvas.height * LALOLibPlots[LALOLibPlotsIndex].data[i][0] ;
			color = LALOLibPlots[LALOLibPlotsIndex].data[i][2];
		
			ctx.fillStyle = "rgb(" + Math.floor(255*(1-color[0])) + "," + Math.floor(255*(1-color[1])) + "," + Math.floor(255*(1-color[2])) + ")";
			ctx.fillRect( x , y, pixWidth +1,  pixHeight +1); // +1 to avoid blank lines between pixels

		}
	}
	
	// add legend / colormap

	var legend = document.getElementById("legend" +LALOLibPlotsIndex);
	var ctx = legend.getContext("2d");

	for ( i=0; i< 255;i++) {
		y = Math.floor(i * legend.height / 255);
		ctx.fillStyle = "rgb(" + (255-i) + "," + (255-i) + "," + (255-i) + ")";
		ctx.fillRect( 0, y, legendwidth , (legend.height / 255) + 1) ;
	}	
	
	// Prepare mouseposition info
	LALOLibPlots[LALOLibPlotsIndex].pixelWidth = pixWidth; 
	LALOLibPlots[LALOLibPlotsIndex].pixelHeight = pixHeight;
	LALOLibPlotsIndex++;
}



function parseColor( str ) {
	if ( typeof(str) == "undefined") 
		return -1;
		
	var color;
	switch( str ) {
	case "k":
	case "black":
		color = 0;
		break;
	case "blue":
	case "b":
		color = 1;
		break;
	case "r":
	case "red":
		color = 2;
		break;
	case "g":
	case "green":
		color = 3;
		break;
	case "m":
	case "magenta":
		color = 4;
		break;
	case "y":
	case "yellow":
		color = 5;
		break;
	
	default:
		color = -1;
		break;
	}
	return color;
}

function mousezoom ( e, delta , plotidx) {
	if (!e) 
    	e = window.event;
 	
 	e.preventDefault();
	
	if ( typeof(plotidx) == "undefined")
		var plotidx = 0;
	
	if ( typeof(delta) == "undefined") {
		var delta = 0;
		
		// normalize the delta
		if (e.wheelDelta) {
		     // IE and Opera
		    delta = e.wheelDelta / 30;
		} 
		else if (e.detail) { 
		    delta = -e.detail ;
		}
	} 
	else {
		if (e.button != 0 )
			delta *= -1;
	}
		
	var plotcanvas = document.getElementById(LALOLibPlots[plotidx].canvasId);
	var rect = plotcanvas.getBoundingClientRect();
	var x = e.clientX - rect.left;	// mouse coordinates relative to plot
	var y = e.clientY - rect.top;
	LALOLibPlots[plotidx].zoom(1+delta/30,1+delta/30, x, y);	
}
function zoomoriginal(plotidx) {
	LALOLibPlots[plotidx].resetzoom(); 
}
function mouseposition( e , plotidx) {
	var plotcanvas = document.getElementById(LALOLibPlots[plotidx].canvasId);
	var rect = plotcanvas.getBoundingClientRect();

	var xmouse = e.clientX - rect.left;	// mouse coordinates relative to plot
	var ymouse = e.clientY - rect.top;

	if ( LALOLABPLOTMOVING ) {	
		var dx = xmouse - LALOLABPLOTxprev ;
		var dy = ymouse - LALOLABPLOTyprev;
		if ( Math.abs( dx ) > 1 || Math.abs( dy ) > 1 ) {			
			LALOLibPlots[plotidx].translate(dx, dy);
		}
		LALOLABPLOTxprev = xmouse;
		LALOLABPLOTyprev = ymouse;		
	}
	else {		
		var x = xmouse / LALOLibPlots[plotidx].scaleX + LALOLibPlots[plotidx].minX;
		var y = (plotcanvas.height - ymouse ) / LALOLibPlots[plotidx].scaleY + LALOLibPlots[plotidx].minY;
	
		document.getElementById("lblposition" + plotidx).innerHTML = "x = " + x.toFixed(3) + ", y = " + y.toFixed(3);	
	}
}

function mousestartmove( e , plotidx) {
	if ( e.button == 0 ) {
		LALOLABPLOTMOVING = true;
		var plotcanvas = document.getElementById(LALOLibPlots[plotidx].canvasId);
		var rect = plotcanvas.getBoundingClientRect();
		LALOLABPLOTxprev = e.clientX - rect.left;	// mouse coordinates relative to plot
		LALOLABPLOTyprev = e.clientY - rect.top;
	}
	else {
		LALOLABPLOTMOVING = false;
	}
}
function mousestopmove( e ) {
	LALOLABPLOTMOVING = false;
}

function mouseimageposition( e, plotidx ) {
	var plotcanvas = document.getElementById(LALOLibPlots[plotidx].canvasId);
	var rect = plotcanvas.getBoundingClientRect();

	var xmouse = e.clientX - rect.left;	// mouse coordinates relative to plot
	var ymouse = e.clientY - rect.top;

	var n = LALOLibPlots[plotidx].style[1];
	var minX = LALOLibPlots[plotidx].style[2];	
	var maxX = LALOLibPlots[plotidx].style[3];	
	var i = Math.floor(ymouse / LALOLibPlots[plotidx].pixelHeight);
	var j = Math.floor(xmouse / LALOLibPlots[plotidx].pixelWidth );
	if ( j < n ) {
		var val = LALOLibPlots[plotidx].data[i*n + j][2][0]*(maxX - minX) + minX;
	
		document.getElementById("lblposition" + plotidx).innerHTML = "Matrix[ " + i + " ][ " + j + " ] = " + val.toFixed(3);
	}
}
/////////////////////////////////
//// Parser
////////////////////////////////

function lalo( Command ) {
	// Parse command line and execute in current scopes	
	var cmd = laloparse( Command );
	var res = self.eval(cmd); 
	return res; 
}
function laloparse( WorkerCommand ) {
	// Parse Commands
	var WorkerCommandList = WorkerCommand.split("\n");
	var k;
	var cmd = "";
	for (k = 0; k<WorkerCommandList.length; k++) {
		if( WorkerCommandList[k].length > 0 ) {
		  	if ( WorkerCommandList[k].indexOf("{") >= 0 || WorkerCommandList[k].indexOf("}") >= 0) {
		  		// this line includes braces => plain javascript: do not parse it!
		  		cmd += WorkerCommandList[k];
		  		if ( WorkerCommandList[k].indexOf("}") >= 0 ) {
		  			// braces closed, we can end the line
			  		cmd += " ;\n"; 
			  	}				  	
		  	}
		  	else {
		  		// standard lalolab line
		  		cmd += parseCommand(WorkerCommandList[k]) + " ;\n"; 
		  	}
		}
	}
	return cmd; 
}
function parseSplittedCommand( cmd ) {
	//console.log("parsing : " + cmd);
	// !!! XXX should parse unary ops before all the others !!! 
	
	var ops = ["==", "!=", ">=" ,"<=", ">", "<" , "\\" ,":", "+", "-",  ".*", "*", "./" ,  "^", "'"]; // from lowest priority to highest
	var opsFcts = ["isEqual" , "isNotEqual", "isGreaterOrEqual", "isLowerOrEqual", "isGreater" , "isLower", "solve","range", "add", "sub", "entrywisemul", "mul" , "entrywisediv",  "pow", "undefined" ];
	var unaryOpsFcts = ["", "", "", "", "","", "","range","", "minus", "", "" , "",  "", "transpose" ];
	
	var o;
	var i ;
	var k;
	var operandA;
	var operandB;

	for ( o = 0; o < ops.length; o++) {
		
		var splitted_wrt_op = cmd.split(ops[o]);
		
		if ( splitted_wrt_op.length > 1) {			
			if ( removeSpaces(splitted_wrt_op[0]) != "" ) {				
				// there is actually a left-hand side operand
				if( removeSpaces(splitted_wrt_op[1]) != "" ) {
					// and a right-hand side operand
					operandA = parseSplittedCommand(splitted_wrt_op[0]);

					for ( k = 1; k< splitted_wrt_op.length ; k++) {
						operandB = splitted_wrt_op[k];
						operandA =  opsFcts[o] + "(" + operandA +  "," + parseSplittedCommand(operandB) + ")";
					}
					cmd = operandA; 
				}
				else {
					// no right-hand side: like transpose operator
					cmd = unaryOpsFcts[o] + "(" + parseSplittedCommand(splitted_wrt_op[0]) + ")";
				}
			}
			else {
				// no left operand: like minus something...
				
				// Apply unary operator
				operandA = unaryOpsFcts[o] + "(" + parseSplittedCommand(splitted_wrt_op[1]) + ")";
				
				// and then binary operator for the remaining occurences
				for ( k = 2; k< splitted_wrt_op.length ; k++) {
					operandB = splitted_wrt_op[k];
					operandA =  opsFcts[o] + "(" + operandA +  "," + parseSplittedCommand(operandB) + ")";
				}
				cmd = operandA; 
			}
		}
	}
	
	return cmd;
	
}

function parseAssignment ( assignmentStr ) {
	if ( assignmentStr.indexOf("[") < 0 ) {
		// straightforward assignment 
		return assignmentStr; 
	}
	else {
		var assign = removeSpaces(assignmentStr).replace("=","").replace(",","][");
		var middle = assign.indexOf("][");
		var start = assign.indexOf("[");
		var varname = assign.substr(0,start);
		if ( middle >= 0 ) {
			// submatrix assignment
			var rowsrange = assign.substr( start + 1, middle-start-1); 

			// find last "]";
			var end = middle+1;
			while ( assign.indexOf("]",end+1) >= 0)
				end = assign.indexOf("]",end+1);
			
			var colsrange = assign.substr(middle+2, end - (middle+2)); // everything after "]["	and before last "]"	

			// Parse colon ranges
			var rowssplit = rowsrange.split(":");
			if (rowssplit.length == 2 ){
				if ( rowssplit[0] =="" && rowssplit[1] =="" )
					rowsrange = "[]";
				else
					rowsrange = "range(" + rowssplit[0] + "," + rowssplit[1] + ")";
			}
			else if ( rowssplit.length == 3)
				rowsrange = "range(" + rowssplit[0] + "," + rowssplit[2] + "," + rowssplit[1] + ")";
			
			var colssplit = colsrange.split(":");
			if (colssplit.length == 2 ) {
				if ( colssplit[0] =="" && colssplit[1] =="" )
					colsrange = "[]";
				else
					colsrange = "range(" + colssplit[0] + "," + colssplit[1] + ")";
			}
			else if ( colssplit.length == 3)
				colsrange = "range(" + colssplit[0] + "," + colssplit[2] + "," + colssplit[1] + ")";

			return "set( " + varname + "," + rowsrange + "," + colsrange + ", ";
		}
		else {
			// subvector assignment
			
			// find last "]";
			var end = start;
			while ( assign.indexOf("]",end+1) >= 0)
				end = assign.indexOf("]",end+1);
			
			var rowsrange = assign.substr( start + 1, end-start-1); 
			
			// Parse colon ranges
			var rowssplit = rowsrange.split(":");
			if (rowssplit.length == 2 ){
				if ( rowssplit[0] =="" && rowssplit[1] =="" )
					rowsrange = "[]";
				else
					rowsrange = "range(" + rowssplit[0] + "," + rowssplit[1] + ")";
			}
			else if ( rowssplit.length == 3)
				rowsrange = "range(" + rowssplit[0] + "," + rowssplit[2] + "," + rowssplit[1] + ")";

			return "set( " + varname + "," + rowsrange + ", ";
		}
	}
}

function parseBrackets( cmdString ) {
	// Parse brackets => get matrix entries
	
	var delimiters = ["[", "(",",",";",")", "\\", "+", "-", "*", "/", ":", "^", "'", "=", ">", "<", "!"];
	
	cmdString = cmdString.split("][").join(","); // replace ][ by , and ] by )
	
	var cmd = cmdString.split("");	// string to array of char
	
	var i; 
	var j;
	var k;
	var l;
	var lhs;
	
	// For the entire string:	
	i = cmd.length - 1;
	while ( i >= 0 ) {
		// Search for the right-most opening bracket:
		while ( i >= 0 && cmd[i] != "[" ) 
			i--;
		
		if ( i >= 0 ) {
			// found a bracket,  find its corresponding closing bracket
			j = i+1;
			while ( j < cmd.length && cmd[j] != "]" ) 
				j++;

			if ( j < cmd.length ) {		

				// then determine its left-hand side operand:
				l = 0;
				k = 0;
				while ( k < i ) {
					if ( delimiters.indexOf(cmd[k]) >= 0)
						l = k+1;
					k++;
				}
				lhs = cmd.slice(l,i).join(""); // should be LHS as string or "" if l >= i

				if ( removeSpaces(lhs) == "" ) {
					// if the LHS operand is empty, leave the brackets untouched 
					cmd[i] = "#"; // (replace by # and $ re-replace at the end by a matrix creation)
					
					// look for semicolon within brackets: 
					k = i+1; 
					var rowwise = false; 
					var colwise = false; 
					while (  k < j ) {
						if( cmd[k] == "," ) {
							//colwise = true;
						}
						
						if ( cmd[k] == ";" ) {
							rowwise = true; // mark for rowwise mat
							
							if ( colwise ) {
								cmd.splice(k,1, ["@", ","] ); // end previous row vector, replace by comma  
								colwise = false;
							}
							else {
								cmd[k] = ","; // simply replace by comma
							}
						}
						
						
						k++; 
					} 
					
					if ( rowwise ) 
						cmd[j] = "$";
					else
						cmd[j] = "@";
					
				}
				else {						
					// if not empty, implement a GET
					cmd[l]="get(" + lhs ;
					for ( k = l+1; k < i; k++)
						cmd[k] = "";
					cmd[i] = ",";
					cmd[j] = ")";					
				}
			}
			else {
				return undefined; // error no ending bracket;
			}
		}
		i--;
	}
		
	var cmdparsed = cmd.join("").split("#").join("mat([").split("$").join("], true)").split("@").join("])");
	//console.log(cmdparsed);
	return cmdparsed;
}

function parseCommand( cmdString ) {

	// Remove comments at the end of the line
	var idxComments = cmdString.indexOf("//");
	if ( idxComments >= 0 )
		cmdString = cmdString.substr(0,idxComments);
	

	// Parse "=" sign to divide between assignement String and computeString
	var idxEqual = cmdString.split("==")[0].split("!=")[0].split(">=")[0].split("<=")[0].indexOf("=");
	if ( idxEqual > 0 )  {
		var assignmentStr = parseAssignment( cmdString.substr(0,idxEqual + 1) );
		var computeStr = cmdString.substr(idxEqual+1);
		
		// Check for simple assignments like A = B to force copy
		if ( assignmentStr.indexOf("set(") < 0 && typeof(self[removeSpaces(computeStr)]) != "undefined" ) { //self.hasOwnProperty( removeSpaces(computeStr) ) ) { // self.hasOwnProperty does not work in Safari workers....
		
			// computeStr is a varaible name
			if ( !isScalar(self[ removeSpaces(computeStr) ] ) ) { 
				// the variable is a vector or matrix
				var FinalCommand = assignmentStr + "matrixCopy(" + computeStr + ")";
				console.log(FinalCommand);
				return FinalCommand;
			}
		}		
	}
	else {
		var assignmentStr = "";		
		var computeStr = cmdString;
	}
	
	// parse brackets:
	var cmd =  parseBrackets( computeStr ).split(""); // and convert string to Array

	// Parse delimiters 
	var startdelimiters = ["(","[",",",";"];
	var enddelimiters = [")","]",",",";"];
	var i;
	var j;
	var k;
	var parsedContent = "";
	var parsedCommand = new Array(cmd.length);

	var map = new Array(cmd.length ) ;
	for ( k=0;k<cmd.length;k++) {
		map[k] = k;
		parsedCommand[k] = cmd[k];
	}
	
	i = cmd.length - 1; 
	while ( i >= 0 ) {
		// Find the most right starting delimiter
		while ( i >= 0 && startdelimiters.indexOf(cmd[i]) < 0 )
			i--;
		if ( i >= 0 ) {
			// found a delimiter, search for the closest ending delimiter
			j = i+1;
			while ( j < cmd.length && enddelimiters.indexOf(cmd[j] ) < 0 ) {				
				j++;
			}
			if ( j < cmd.length ) {			
				// starting delimiter is at cmd[i] and ending one at cmd[j]
				
				// parse content within delimiters
				parsedContent = parseSplittedCommand( parsedCommand.slice(map[i]+1,map[j]).join("") ) ;
				// and replace the corresponding content in the parsed command
				parsedCommand.splice (map[i]+1, map[j]-map[i]-1, parsedContent ) ;
				
				// remove delimiters from string to be parsed 
				if ( cmd[i] != "," ) 
					cmd[i] = " ";	// except for commas that serve twice (once as start once as end)
				cmd[j] = " ";
								
				// map position in the original cmd to positions in the parsedCommand to track brackets
				for ( k=i+1; k < j;k++)
					map[k] = map[i]+1;
				var deltamap = map[j] - map[i] - 1;
				for ( k=j; k < cmd.length;k++)
					map[k] += 1 - deltamap; 
					
				/*console.log(parsedCommand);
				console.log(cmd.join(""));
				console.log(map);
				console.log(i + " : " + j);*/
			}
			else {
				return "undefined";
			}				
		}
		i--;
	}
	var FinalCommand = assignmentStr + parseSplittedCommand(parsedCommand.join(""));
	
	// Parse brackets => get matrix entries
	//cmdString = cmdString.split("][").join(",").split("]").join(")");	// replace ][ by , and ] by )
	// consider [ as a left-hand unary operator 
//	cmd = "get(" + parseSplittedCommand(splitted_wrt_op[0]) + ")";

	
	
	if ( assignmentStr.substr(0,4) == "set(" ) 
		FinalCommand  += " )";

	FinalCommand = parseRangeRange(	FinalCommand );

	console.log(FinalCommand);
	return FinalCommand;
}

function parseRangeRange( cmd ) {
	// parse complex ranges like 0:0.1:4
	var elems = cmd.split("range(range(");
	var i;
	var j;
	var tmp;
	var args;
	var incargs;
	var endargs;
	for ( i = 0; i< elems.length - 1 ; i++) {
	
//		elems[i+1] = elems[i+1].replace(")","");	
		
		// ivert second and third arguments to get range(start, end, inc) from start:inc:end
		args = 	elems[i+1].split(",");
		tmp = args[2].split(")"); // keep only the content of the range and not the remaining commands
		endargs = tmp[0];
		j = 0;	// deal with cases like end="minus(4)" where the first closing bracket is not at the complete end
		while ( tmp[j].indexOf("(") >= 0 ) {
			endargs = endargs + ")" + tmp[j+1]; 
			j++;
		}
			
		incargs = args[1].substr(0,args[1].length-1); // remove ")" 
		args[1] = endargs;
		//endargs[0] = incargs;
		args[2] = incargs + ")" + tmp.slice(j+1).join(")");
		elems[i+1] = args.join(",");
	}
	return elems.join("range(");//replace range(range( by range(
}

function removeSpaces( str ) {
	return str.split(" ").join("");
}

////////////////////////////
/// Lab 
////////////////////////////
function MLlab ( id , path ) {
	var that = new Lalolab ( id, true, path);	
	return that;
}
function Lalolab ( id, mllab , path ) {
	// constructor for a Lab with independent scope running in a worker
	this.id = id;
	
	this.callbacks = new Array(); 	
	
	// Create worker with a Blob  to avoid distributing lalolibworker.js 
	// => does not work due to importScripts with relative path to the Blob unresolved (or cross-origin)
	
	if ( typeof(path) == "undefined" )
		var path = "http://mlweb.loria.fr/";
	else {
		if (path.length > 0 && path[path.length-1] != "/" )
			path = [path,"/"].join("");
	}
		
	if ( typeof(mllab) != "undefined" && mllab ) {
		this.worker = new Worker(path+"mlworker.js"); // need mlworker.js in same directory as web page
		this.labtype = "ml";
		/* Using a Blob to avoid distributing mlworker.js: 
		 	does not work because of importScripts from cross origin...
		var workerscript = "importScripts(\"ml.js\");\n onmessage = function ( WorkerEvent ) {\n	var WorkerCommand = WorkerEvent.data.cmd;var mustparse = WorkerEvent.data.parse; \n if ( mustparse )\n	var res = lalo(WorkerCommand);\n 	else {\n	if ( WorkerCommand == \"load_mat\" ) {\n	if ( type(WorkerEvent.data.data) == \"matrix\" )\n var res = new Matrix(WorkerEvent.data.data.m,WorkerEvent.data.data.n,WorkerEvent.data.data.val, true);\nelse\n 	var res = mat(WorkerEvent.data.data, true);\n	eval(WorkerEvent.data.varname + \"=res\");\n}\n else\n var res = self.eval( WorkerCommand ) ;\n}\n try {\n	postMessage( { \"cmd\" : WorkerCommand, \"output\" : res } );\n} catch ( e ) {\n try {\n postMessage( { \"cmd\" : WorkerCommand, \"output\" : res.info() } );\n	} catch(e2) { \n postMessage( { \"cmd\" : WorkerCommand, \"output\" : undefined } );\n}\n}\n}";
		var blob = new Blob([workerscript], { "type" : "text/javascript" });
		var blobURL = window.URL.createObjectURL(blob);
		console.log(blobURL);
		this.worker = new Worker(blobURL);*/
	}
	else {
		this.worker = new Worker(path+"lalolibworker.js"); // need lalolibworker.js in same directory as web page
		this.labtype = "lalo";
	}
	this.worker.onmessage = this.onresult; 
	this.worker.parent = this;
}
Lalolab.prototype.close = function ( ) {
	this.worker.terminate();
	this.worker.parent = null;// delete circular reference
}
Lalolab.prototype.onprogress = function ( ratio ) {
	// do nothing by default; 
	// user must set lab.onprogress = function (ratio) { ... } to do something
}
Lalolab.prototype.onresult = function ( WorkerEvent ) {
//	console.log(WorkerEvent, ""+ this.parent.callbacks);
	if ( typeof(WorkerEvent.data.progress) != "undefined" ) {
		this.parent.onprogress( WorkerEvent.data.progress ) ;
	}
	else {
		var cb =  this.parent.callbacks.splice(0,1)[0] ; // take first callback from the list
		if ( typeof(cb) == "function" ) {
			var WorkerCommand = WorkerEvent.data.cmd;
			var WorkerResult = WorkerEvent.data.output;
			cb(	WorkerResult, WorkerCommand, this.parent.id ); // call the callback if present
		}
	}
}
Lalolab.prototype.do = function ( cmd , callback ) {
	// prepare callback, parse cmd and execute in worker
	this.callbacks.push(  callback  ) ;	
	this.worker.postMessage( {cmd: cmd, parse: true} );	 
}
Lalolab.prototype.exec = function ( cmd , callback ) {
	// prepare callback, and execute cmd in worker
	this.callbacks.push( callback ); 
	this.worker.postMessage( {cmd: cmd, parse: false} );	
}
Lalolab.prototype.parse = function ( cmd , callback ) {
	// prepare callback, parse cmd and execute in worker
	this.callbacks.push( callback ); 
	this.worker.postMessage( {cmd: cmd, parse: false} );	 
}
Lalolab.prototype.load = function ( data , varname, callback ) {
	// load data in varname
	this.callbacks.push(  callback  ) ;	
	if ( typeof(data) == "string" ){
		this.worker.postMessage( {"cmd" : varname + "= load_data (\"" + data + "\")", parse: false} );
	}
	else {
		this.worker.postMessage( {"cmd" : "load_mat", data: data, varname: varname, parse: false} );
	}			
}
Lalolab.prototype.import = function ( script, callback ) {
	// load a script in lalolib language
	this.do('importLaloScript("' + script + '")', callback);	
}
function importLaloScript ( script ) {
	// load a script in lalolib language in the current Lab worker
	var xhr = new XMLHttpRequest();
	xhr.open('GET', script, false);
	xhr.send();
	var cmd = xhr.responseText;
 	return lalo(cmd); 
}
Lalolab.prototype.importjs = function ( script, callback ) {
	// load a script in javascript
	this.exec("importScripts('" + script + "');", callback); 
}
Lalolab.prototype.getObject = function ( varname, callback ) {
	this.exec("getObjectWithoutFunc(" + varname +")", function (res) {callback(renewObject(res));} );
}

function getObjectWithoutFunc( obj ) {
	// Functions and Objects with function members cannot be sent 
	// from one worker to another...
	
	if ( typeof(obj) != "object" ) 
		return obj;
	else {
		var res = {};

		for (var p in obj ) {
			switch( type(obj[p]) ) {
			case "vector": 
				res[p] = {type: "vector", data: [].slice.call(obj[p])};
				break;
			case "matrix":
				res[p] = obj[p];
				res[p].val = [].slice.call(obj[p].val);
				break;
			case "spvector":
				res[p] = obj[p];
				res[p].val = [].slice.call(obj[p].val);
				res[p].ind = [].slice.call(obj[p].ind);
				break;
			case "spmatrix":
				res[p] = obj[p];
				res[p].val = [].slice.call(obj[p].val);
				res[p].cols = [].slice.call(obj[p].cols);
				res[p].rows = [].slice.call(obj[p].rows);
				break;
			case "undefined":
				res[p] = obj[p];
				break;
			case "function":
				break;
			case "Array":
				res[p] = getObjectWithoutFunc( obj[p] );
				res[p].type = "Array";
				res[p].length = obj[p].length;
				break;
			default:
				res[p] = getObjectWithoutFunc( obj[p] );
				break;			
			}	
		}
		return res;
	}
}
function renewObject( obj ) {
	// Recreate full object with member functions 
	// from an object created by getObjectWithoutFunc()

	var to = type(obj);
	switch( to ) {
		case "number":
		case "boolean":
		case "string":
		case "undefined":
			return obj;
			break;
		case "vector":
			return new Float64Array(obj.data);
			break;
		case "matrix":
			return new Matrix(obj.m, obj.n, obj.val);
			break;
		case "spvector":
			return new spVector(obj.length,obj.val,obj.ind);
			break;
		case "spmatrix":
			return new spMatrix(obj.m, obj.n, obj.val, obj.cols, obj.rows);
			break;
		case "object":
			// Object without type property and thus without Class		
			var newobj = {}; 
			for ( var p in obj ) 
				newobj[p] = renewObject(obj[p]);
			return newobj;
			break;
		case "Array":
			var newobj = new Array(obj.length);
			for ( var p in obj ) 
				newobj[p] = renewObject(obj[p]);
			return newobj;
		default:
			// Structured Object like Classifier etc... 
			// type = Class:subclass
			var typearray = obj.type.split(":");
			var Class = eval(typearray[0]);
			if ( typearray.length == 1 ) 
				var newobj = new Class(); 
			else 
				var newobj = new Class(typearray[1]);
			for ( var p in obj ) 
				newobj[p] = renewObject(obj[p]);
				
			// deal with particular cases: 
			// Rebuild kernelFunc 
			if (typearray[1] == "SVM" || typearray[1] == "SVR" ) {				
				newobj["kernelFunc"] = kernelFunction(newobj["kernel"], newobj["kernelpar"], type(newobj["SV"]) == "spmatrix"?"spvector":"vector");
			}
			if (typearray[1] == "KernelRidgeRegression" ) {
				newobj["kernelFunc"] = kernelFunction(newobj["kernel"], newobj["kernelpar"], type(newobj["X"]) == "spmatrix"?"spvector":"vector");
			}
			
			return newobj;
			break;
	}
}

function load_data ( datastring ) {

	// convert a string into a matrix data 
	var i;
	var cmd = "mat( [ "; 
	var row;
	var rows = datastring.split("\n");
	var ri ;
	for ( i=0; i< rows.length - 1; i++) {
		ri = removeFirstSpaces(rows[i]);
		if ( ri != "" ) {
			row = ri.replace(/,/g," ").replace(/ +/g,",");
			cmd += "new Float64Array([" + row + "]) ,";
		}
	}
	ri = removeFirstSpaces(rows[rows.length-1]);
	if ( ri != "" ) {
		row = ri.replace(/,/g," ").replace(/ +/g,",");
		cmd += "new Float64Array([" + row + "]) ] , true) ";
	}
	else {
		cmd = cmd.substr(0,cmd.length-1); // remove last comma
		cmd += "] , true) ";
	}
		
	return eval(cmd);
	
}

function removeFirstSpaces( str ) {
	//remove spaces at begining of string
	var i = 0;
	while ( i < str.length && str[i] == " " )
		i++;
	if ( i<str.length ) {
		// first non-space char at i
		return str.slice(i);	
	}
	else 
		return "";
}

//// progress /////////////////////
function notifyProgress( ratio ) {
	postMessage( { "progress" : ratio } );
	console.log("progress: " + ratio);
}



//////////////////////////
//// CONSTANTS and general tools
///////////////////////////
var LALOLIB_ERROR = ""; 

const EPS = 2.2205e-16;

function isZero(x) {
	return (Math.abs(x) < EPS ) ;
}
function isInteger(x) {
	return (Math.floor(x) == x ) ;
}

function tic( T ) {
	if ( typeof(TICTOCstartTime) == "undefined" )
		TICTOCstartTime = new Array();
	if (typeof(T) == "undefined")
		var T = 0;
	TICTOCstartTime[T] = new Date();
}
function toc ( T ) {
	if ( typeof(T) == "undefined" )
		var T = 0;
	if ( typeof(TICTOCstartTime) != "undefined" && typeof(TICTOCstartTime[T]) != "undefined" ) {		
		// Computing time
		var startTime = TICTOCstartTime[T];
		var endTime = new Date();
		var time = ( endTime - startTime) / 1000;  // in seconds
		return time;
	}
	else
		return undefined;
}
/**
 * @return {string} 
 */
function type( X ) {
	if ( X == null )
		return "undefined";
	else if ( X.type )
 		return X.type;	 			 	
 	else {
	 	var t = typeof( X );
		if ( t == "object") {
			if ( Array.isArray(X) ) {
				if ( isArrayOfNumbers(X) )
			 		return "vector";	// for array vectors created by hand
			 	else 
			 		return "Array";
			}
			else if ( X.buffer ) 
		 		return "vector"; // Float64Array vector
		 	else 
		 		return t;
		}
		else 
			return t;		 
	}
}
/**
 * @param {Array}
 * @return {boolean} 
 */
function isArrayOfNumbers( A ) {
	for (var i=0; i < A.length; i++)
		if ( typeof(A[i]) != "number" )
			return false;
	return true;
}
function isScalar( x ) {
	switch( typeof( x ) ) {
		case "string":
		case "number":
		case "boolean":
			return true;
			break;		
		default:
			if (type(x) == "Complex")
				return true;
			else
				return false;
			break;
	}
}

/**
 * @param {Float64Array}
 * @return {string} 
 */
function printVector( x ) {
	const n = x.length;
	var str = "[ ";
	var i = 0;
	while ( i < n-1 && i < 5 ) {
		str += (isInteger( x[i] ) ? x[i] : x[i].toFixed(3) ) + "; ";
		i++;
	}
	if ( i == n-1 )
		str += (isInteger( x[i] ) ? x[i] : x[i].toFixed(3) ) + " ]" ;
	else 
		str += "... ] (length = " + n + ")";

	return str;	
}


//////////////////////////////
// Matrix/vector creation
//////////////////////////////
/**
 * @constructor
 * @struct
 */
function Matrix(m,n, values) {
	
	/** @const */ this.length = m;
	/** @const */ this.m = m;
	/** @const */ this.n = n;
	/** @const */ this.size = [m,n];
	/** @const */ this.type = "matrix";
	
	if ( arguments.length == 2)
		this.val = new Float64Array( m * n ); // simple m x n zeros
	else if (arguments.length == 3)
		this.val = new Float64Array( values ); // m x n filled with values with copy
	else if (arguments.length == 4)
		this.val =  values ; // m x n filled with values without copy
}

Matrix.prototype.get = function ( i,j) {
	return this.val[i*this.n + j]; 
}
Matrix.prototype.set = function ( i,j, v) {
	this.val[i*this.n + j] = v; 
}
/**
 * return a pointer-like object on a row in a matrix, not a copy!
 * @param {number}
 * @return {Float64Array} 
 */
Matrix.prototype.row = function ( i ) {
	return this.val.subarray(i*this.n, (i+1)*this.n);
}

/**
 * return a copy of the matrix as an Array of Arrays
 * (do not do this with too many rows...)
 * @return {Array} 
 */
Matrix.prototype.toArray = function ( ) {
	var A = new Array(this.m);
	var ri = 0;
	for ( var i=0; i < this.m; i++) {
		A[i] = new Array(this.n);
		for ( var j=0; j < this.n; j++)
			A[i][j] = this.val[ri + j];
		ri += this.n;
	}	
	return A;
}
/**
 * return a view (not a copy) on the matrix as an Array of Float64Array 
 * (do not do this with too many rows...)
 * @return {Array} 
 */
Matrix.prototype.toArrayOfFloat64Array = function ( ) {
	var A = new Array(this.m);
	for ( var i=0; i < this.m; i++)
		A[i] = this.val.subarray(i*this.n, (i+1)*this.n);
		
	return A;
}

function array2mat( A ) {
	return mat(A, true);
}
function array2vec( a ) {
	return vectorCopy(a);
}
function vec2array( a ) {
	return Array.apply([], a);
}


function size( A, sizealongdimension ) {
	var s;
	switch( type(A) ) {
	case "string":
	case "boolean":
	case "number":
	case "Complex":
		s = [1,1];
		break;
	case "vector":
	case "spvector":
	case "ComplexVector":
		s = [A.length, 1];
		break;
	case "matrix":
	case "spmatrix":
	case "ComplexMatrix":	
		s = A.size; 
		break;
	case "object":
		s = [1,1];
		break;
	default: 
		s = [1,1]; 
		//error( "Cannot determine size of object" );
		break;
	}
	
	if ( typeof(sizealongdimension) == "undefined" ) 
		return s;
	else
		return s[sizealongdimension-1];	

}

function ones(rows, cols) {
	// Create a matrix or vector full of ONES 
	if ( arguments.length == 1 || cols == 1 ) {
		var v = new Float64Array(rows);
		for (var i = 0; i< rows; i++) 
			v[i] = 1;
		return v;
	} 
	else {
		var M = new Matrix(rows, cols); 
		const mn = rows*cols; 
		for (var i = 0; i< mn; i++) {
			M.val[i] = 1;
		}
		return M;
	}
}
// Use zeros( m, n) 
function zeros(rows, cols) {
	// Create a matrix or vector of ZERO 
	if ( arguments.length == 1 || cols == 1 ) { 
		return new Float64Array(rows);
	} 
	else {
		return new Matrix(rows, cols); 
	}	
}

function eye(m,n) {
	if ( typeof(n) == "undefined") 
		var n = m;
	if ( m == 1 && n == 1)
		return 1;
		
	var I = zeros(m,n);
	const e = (m<n)?m:n;
	for ( var i = 0; i< e; i ++) {
		I.val[i*(n+1)] = 1;
	}
	
	return I;
}

function diag( A ) {
	var i;
	var typeA = type(A);
	if (typeA == "vector" ) {
		var M = zeros(A.length,A.length);
		var j = 0;
		const stride = A.length+1;
		for ( i=0; i < A.length; i++) {
				M.val[j] = A[i];
				j += stride;
		}
		return M;
	}
	else if ( typeA =="matrix") {
		var n = Math.min(A.m, A.n);
		var v = new Float64Array(n);
		var j = 0;
		const stride2 = A.n+1;
		for ( i =0; i< n;i++) {
			v[i] = A.val[j];	
			j+=stride2;
		}
		return v;
	}
	else if (typeA == "ComplexVector" ) {
		var M = new ComplexMatrix(A.length,A.length);
		var j = 0;
		const stride = A.length+1;
		for ( i=0; i < A.length; i++) {
				M.re[j] = A.re[i];
				M.im[j] = A.im[i];
				j += stride;
		}
		return M;
	}
	else if ( typeA == "ComplexMatrix") {
		var n = Math.min(A.m, A.n);
		var v = new ComplexVector(n);
		var j = 0;
		const stride2 = A.n+1;
		for ( i =0; i< n;i++) {
			v.re[i] = A.re[j];	
			v.im[i] = A.im[j];
			j+=stride2;
		}
		return v;
	}
}

/**
 * @param {Matrix}
 * @return {Float64Array} 
 */
function vec( A ) {
	return new Float64Array(A.val); 
}

function matrixCopy( A ) {
	var t = type(A) ;
	switch(t) {
	case "vector":
		return vectorCopy(A);
		break;
	case "ComplexVector":
		return new ComplexVector(A);
		break;
	case "matrix":
		return new Matrix(A.m, A.n, A.val);
		break;
	case "ComplexMatrix":
		return new ComplexMatrix(A);
		break;
	case "Array":
		return arrayCopy ( A ) ;
		break;
	case "spvector":
	case "spmatrix":
		return A.copy();
		break;
	default:
		error("Error in matrixCopy(A): A is not a matrix nor a vector.");
		return undefined;
		break;
	}
}
/**
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function vectorCopy( a ) {
	return new Float64Array( a );
}
/** Vector copy into another existing vector ( y = x )
 * (saves memory allocation)
 * @param {Float64Array}
 * @param {Float64Array}
 */
function vectorCopyInto (x, y) {
	y.set(x); 
}

/**
 * @param {Array}
 * @return {Array} 
 */
function arrayCopy( A ) {
	var res = new Array(A.length); 
	for ( var i = 0; i < A.length; i++ )
		if ( isScalar(A[i]) )
			res[i] = A[i];	//does not copy 2D Arrays... 
		else
			res[i] = matrixCopy( A[i] ) ;
	return res;
}

/**
 * Return enlarged matrix with one more row of zeros
 * NOTE: both matrices share the same storage and should not be used independently
 * so better use: A = appendRow(A); or just appendRow(A);
 * @param{Matrix}
 * @return{Matrix}
 */
function appendRow ( A ) {
	var Aa = zeros(A.m+1,A.n);
	Aa.val.set(A.val);
	return Aa;
}

/**
 * Reshape the dimensions of a vector/matrix
 * @param{{Float64Array|Matrix}}
 * @param{number}
 * @param{number}
 * @return{{Float64Array|Matrix}}
 */
function reshape ( A, m, n ) {
	var R = undefined;
	var tA = type( A );
	if ( tA == "vector" ) {
		if ( m*n != A.length ) {
			error("Error in reshape(a,m,n): a.length = " + A.length + " != m*n");
		}
		else {
			R = new Matrix(m,n,A);
		}
	}
	else if ( tA == "matrix" ) {
		if ( m*n != A.m*A.n ) {
			error("Error in reshape(A,m,n): A.m * A.n = " + A.m*A.n + " != m*n");
		}
		else {
			if ( n == 1 )
				R = vectorCopy(A.val);
			else
				R = new Matrix(m,n,A.val);			
		}
	}
	else
		error("Error in reshape(A): A is neither a vector nor a matrix.");
	return R;
}



////////////////////////
// slicing functions
////////////////////////

/*
	GET function : returns a copy of a subset of entries
	
	For MATRICES:

	get ( M, rows, cols ) => submatrix of M 
	get ( M, rows ) 	  => subset of rows from M (equiv to rows(M,rows) )
	get ( M, [], cols )   => subset of cols (equiv to cols(M, cols) )
	get ( M, i, j)		  => M[i][j] converted to dense format (0 instead of undefined)
	get ( M ) 			  => M in dense format  (with 0 instead of undefined)
	
	For VECTORS:

	get ( v, rows ) 	  => subvector from v (equiv to rows(v,rows) )
	get ( v, i )		  => v[i] converted to dense format (0 instead of undefined)
	get ( v ) 			  => v in dense format  (with 0 instead of undefined)	

*/
function get ( A , rowsrange, colsrange) {

	var typerows = typeof(rowsrange);
	var typecols = typeof(colsrange);
	
	if (arguments.length == 1 ) 
		return matrixCopy(A);
	
	var typeA = type ( A );
	if ( typeA == "vector" ) {
			
		if ( typerows == "number" ) {
			if (rowsrange >= 0 && rowsrange < A.length)
				return A[rowsrange];	// get v[i]			
			else {
				error("Error in a[i] = get(a,i): Index i="+rowsrange+" out of bounds [0,"+(A.length-1)+"]");
				return undefined;
			}
		}
		else {
			return getSubVector(A, rowsrange);
		}	
	}
	else if ( typeA == "matrix") {		
		
		if ( typerows == "number" )
			rowsrange = [rowsrange];

		if ( typecols == "number" )
			colsrange = [colsrange];

		if ( rowsrange.length == 1 && colsrange.length == 1 ) 
			return A.val[rowsrange[0] * A.n + colsrange[0]];	// get ( A, i, j)			

		if ( rowsrange.length == 0 ) 				
			return getCols(A,colsrange);// get(A,[],4) <=> cols(A,4)
		
		if (colsrange.length == 0 ) 			
			return getRows(A, rowsrange);// get(A,3,[]) <=> rows(A,3)
			
		// otherwise:
		return getSubMatrix(A, rowsrange, colsrange);
		
	}
	else if ( typeA == "Array" ) {
		if ( typerows == "number" )
			return A[rowsrange]; 
		else
			return getSubArray(A, rowsrange);
	}
	else if ( typeA == "spmatrix") {		
		
		if ( typerows == "number" )
			rowsrange = [rowsrange];

		if ( typecols == "number" )
			colsrange = [colsrange];

		if ( rowsrange.length == 1 && colsrange.length == 1 ) 
			return A.get(rowsrange[0], colsrange[0]);   // get ( A, i, j)			

		if ( rowsrange.length == 1 && A.rowmajor )
			return A.row(rowsrange[0]);
		if ( colsrange.length == 1 && !A.rowmajor )
			return A.col(colsrange[0]);
		
		if (colsrange.length == 0 ) 			
			return spgetRows(A, rowsrange);
		if ( rowsrange.length == 0 ) 				
			return spgetCols(A,colsrange);
		
		// TODO
	}
	else if ( typeA == "spvector" ) {
			
		if ( typerows == "number" ) 
			return A.get( rowsrange );	// get v[i]					
		else 
			return getSubspVector(A, rowsrange);//TODO		
	}
	else if ( typeA == "ComplexVector") {
		if ( typerows == "number" ) 
			return A.get( rowsrange );	// get v[i]	
		else
			return A.getSubVector(rowsrange);
	}	
	else if ( typeA == "ComplexMatrix") {		
		
		if ( typerows == "number" )
			rowsrange = [rowsrange];

		if ( typecols == "number" )
			colsrange = [colsrange];
		
		if ( rowsrange.length == 1 && colsrange.length == 1 ) 
			return A.get(i,j);

		if ( rowsrange.length == 0 ) 				
			return A.getCols(colsrange);// get(A,[],4) <=> cols(A,4)
		
		if (colsrange.length == 0 ) 			
			return A.getRows(rowsrange);// get(A,3,[]) <=> rows(A,3)
			
		// otherwise:
		return A.getSubMatrix(rowsrange, colsrange);
	}
	return undefined;
}
function getSubMatrix(A, rowsrange, colsrange) {
	var n = colsrange.length;
	var i;
	var j;
	var res;
	if ( n == 1 ) {
		 res = new Float64Array(rowsrange.length);
		 for (i= 0; i< rowsrange.length ; i++) {
		 	res[i] = A.val[rowsrange[i] * A.n + colsrange[0]];
		 }
	}
	else {
		res = new Matrix(rowsrange.length, n);
		var r = 0;
		
		for (i= 0; i< rowsrange.length ; i++) {			
			var rA = rowsrange[i]*A.n;
			for ( j=0; j < n; j++) {
				res.val[r+j] = A.val[rA + colsrange[j]];
			}
			r += n;
		}
	}
	return res;
}

function getRows(A, rowsrange) {
	var n = rowsrange.length;
	if ( n > 1 ) {
		var res = new Matrix(n, A.n);
		var r=0;
		for ( var i = 0; i < n; i++) {
			for (var j=0; j < A.n; j++)
				res.val[r + j] = A.val[rowsrange[i]*A.n + j]; 
			r += A.n;
		}
		return res;
	}
	else
		return vectorCopy(A.val.subarray( rowsrange[0]*A.n, rowsrange[0]*A.n + A.n));
}
function getCols(A, colsrange) {
	var m = A.m;
	var n = colsrange.length;
	if( n > 1 ) {
		var res = new Matrix(m, n);
		var r = 0;
		var rA = 0;
		for ( var i = 0; i < m; i++) {
			for ( var j = 0; j < n; j++) 
				res.val[r + j] = A.val[rA + colsrange[j]];
				
			r += n;
			rA += A.n;
		}
		return res;
	}
	else {
		var res = new Float64Array(m);
		var r = 0;
		for ( var i = 0; i < m; i++) {
			res[i] = A.val[r + colsrange[0]];
			r += A.n;
		}
		return res;
	}
}
/**
 * @param {Float64Array}
 * @param {Array}
 * @return {Float64Array} 
 */
function getSubVector(a, rowsrange) {
	const n = rowsrange.length;
	var res= new Float64Array( n );
	for (var i = 0; i< n; i++) {
		res[i] = a[rowsrange[i]];
	}
	return res;
}

/**
 * @param {Array}
 * @param {Array}
 * @return {Array} 
 */
function getSubArray(a, rowsrange) {
	const n = rowsrange.length;
	var res= new Array( n );
	for (var i = 0; i< n; i++) {
		res[i] = a[rowsrange[i]];
	}
	return res;
}


function getrowref(A, i) {
	// return a pointer-like object on a row in a matrix, not a copy!
	return A.val.subarray(i*A.n, (i+1)*A.n);
}

/*
	SET function : set values in a subset of entries of a matrix or vector
	
	For MATRICES:

	set ( M, rows, cols, A ) => submatrix of M = A 
	set ( M, rows, A ) 	     => subset of rows from M = A
	set ( M, [], cols, A )   => subset of cols from M = A
	set ( M, i, [], A )   	 => fill row M[i] with vector A (transposed) 
	set ( M, i, j, A)	     => M[i][j] = A
	
	For VECTORS:

	set ( v, rows, a ) 	  => subvector from v = a
	set ( v, i , a)		  => v[i] = a

*/
function set ( A , rowsrange, colsrange, B) {
	var i;
	var j;
	var k;
	var l;
	var n;

	var typerows = typeof(rowsrange);
	var typecols = typeof(colsrange);
	
	if (arguments.length == 1 ) 
		return undefined;
	
	var typeA = type ( A );
	if ( typeA == "vector" ) {
		B = colsrange;
		if ( typerows == "number" ) {
			A[rowsrange] = B;
			return B;
		}
		else if ( rowsrange.length == 0 ) 
			rowsrange = range(A.length);
				
		if ( size(B,1) == 1 ) {
			setVectorScalar (A, rowsrange, B);
		}
		else {
			setVectorVector (A, rowsrange, B);
		}
		return B;
	}
	else if ( typeA == "matrix") {				
	
		if ( typerows == "number" )
			rowsrange = [rowsrange];
		if ( typecols == "number" )
			colsrange = [colsrange];
		
		if ( rowsrange.length == 1 && colsrange.length == 1 ) {
			A.val[rowsrange[0]*A.n + colsrange[0]] = B;	
			return B;
		}
		
		if ( rowsrange.length == 0 ) {
			setCols(A, colsrange, B); 
			return B;
		}
		
		if (colsrange.length == 0 ) {
			setRows( A, rowsrange, B); 
			return B;
		}
		
		// Set a submatrix
		var sB = size(B);
		var tB = type(B);
		if ( sB[0] == 1 && sB[1] == 1 ) {
			if ( tB == "number" )
				setMatrixScalar(A, rowsrange, colsrange, B);
			else if ( tB == "vector" )			
				setMatrixScalar(A, rowsrange, colsrange, B[0]);			
			else
				setMatrixScalar(A, rowsrange, colsrange, B.val[0]);			
		}
		else {
			if ( colsrange.length == 1 )
				setMatrixColVector(A, rowsrange, colsrange[0], B);				
			else if ( rowsrange.length == 1 ) {
				if ( tB == "vector" ) 
					setMatrixRowVector(A, rowsrange[0], colsrange, B);
				else
					setMatrixRowVector(A, rowsrange[0], colsrange, B.val);
			}
			else
				setMatrixMatrix(A, rowsrange, colsrange, B);
		}
		return B;		
	}
	else if ( typeA == "ComplexVector" ) {
		B = colsrange;
		if ( typerows == "number" ) {
			A.set(rowsrange, B);
			return B;
		}
		else if ( rowsrange.length == 0 ) 
			rowsrange = range(A.length);
				
		if ( size(B,1) == 1 ) {
			A.setVectorScalar (rowsrange, B);
		}
		else {
			A.setVectorVector (rowsrange, B);
		}
		return B;
	}
}
		
function setVectorScalar(A, rowsrange, B) {
	var i;
	for (i = 0; i< rowsrange.length; i++) 
		A[rowsrange[i]] = B;
}
function setVectorVector(A, rowsrange, B) {
	var i;
	for (i = 0; i< rowsrange.length; i++) 
		A[rowsrange[i]] = B[i];
}

function setMatrixScalar(A, rowsrange, colsrange, B) {
	var i;
	var j;
	var m = rowsrange.length;
	var n = colsrange.length;
	for (i = 0; i< m; i++) 
		for(j=0; j < n; j++)
			A.val[rowsrange[i]*A.n + colsrange[j]] = B;
}
function setMatrixMatrix(A, rowsrange, colsrange, B) {
	var i;
	var j;
	var m = rowsrange.length;
	var n = colsrange.length;
	for (i = 0; i< m; i++) 
		for(j=0; j < n; j++)
			A.val[rowsrange[i]*A.n + colsrange[j]] = B.val[i*B.n +j];
}
function setMatrixColVector(A, rowsrange, col, B) {
	var i;
	var m = rowsrange.length;
	for (i = 0; i< m; i++) 
		A.val[rowsrange[i]*A.n + col] = B[i];
}
function setMatrixRowVector(A, row, colsrange, B) {
	var j;
	var n = colsrange.length;
	for(j=0; j < n; j++)
		A.val[row*A.n + colsrange[j]] = B[j];
}
function setRows(A, rowsrange, B ) {
	var i;
	var j;
	var m = rowsrange.length;
	var rA;
	switch( type(B) ) {
	case "vector":
		for ( i=0; i<m; i++) {
			rA = rowsrange[i]*A.n;		
			for ( j=0; j<B.length; j++)
				A.val[rA + j] = B[j];
		}
		break;
	case "matrix":		
		var rB = 0;
		for ( i=0; i<m; i++) {
			rA = rowsrange[i]*A.n;
			for ( j=0; j < B.n; j++)
				A.val[rA + j] = B.val[rB + j];		
			rB += B.n;
		}
		break;
	default:
		for ( i=0; i<m; i++) {
			rA = rowsrange[i] * A.n;
			for(j=0; j < A.n; j++)
				A.val[rA + j] = B;
		}
		break;
	}
}
function setCols(A, colsrange, B ) {
	var i;
	var m = A.m;
	var n = colsrange.length;
	var r = 0;
	switch( type(B) ) {
	case "vector":
		for ( i=0; i<m; i++) {
			for (j=0; j < n; j++)
				A.val[r + colsrange[j]] = B[i]; 
			r += A.n;
		}
		break;
	case "matrix":
		for ( i=0; i<m; i++) {
			for (j=0; j < n; j++)
				A.val[r + colsrange[j]] = B.val[i* B.n + j]; 
			r += A.n;
		}			
		break;
	default:		
		for ( i=0; i<m; i++) {
			for(j=0; j < n; j++)
				A.val[r + colsrange[j]] = B;
			r += A.n;
		}
		break;
	}
}

function dense ( A ) {
	return A;
}

// Support
function supp( x ) {
	const tx = type (x);
	if ( tx == "vector" ) {
		var indexes = [];
		var i;
		for ( i = 0; i < x.length;  i++ ) {
			if ( !isZero(x[i]) ) 
				indexes.push(i);
		}
		
		return indexes; 
	}
	else if (tx == "spvector" ) {
		return new Float64Array(x.ind);
	}
	else
		return undefined;
}

// Range
function range(start, end, inc) {
	// python-like range function 
	// returns [0,... , end-1]
	if ( typeof(start) == "undefined" ) 
		return [];
		
	if ( typeof(inc) == "undefined" ) 
		var inc = 1;
	if ( typeof(end) == "undefined" ) {
		var end = start;
		start = 0;
	}		
	
	if ( start == end-inc) {
		return start;
	}
	else if ( start == end) {
		return [];
	}
	else if ( start > end ) {
		if ( inc > 0) 
			inc *= -1;
		var r = new Array( Math.floor ( ( start - end ) / Math.abs(inc) ) );
		var k = 0;
		for ( var i = start; i> end; i+=inc) {
			r[k] = i;
			k++;
		}	
	}
	else {		
		var r = new Array( Math.floor ( ( end - start ) / inc ) );
		var k = 0;
		for ( var i = start; i< end; i+=inc) {
			r[k] = i;
			k++;
		}	
	}
	return r;
}

// Swaping 
/**
 * @param {Matrix}
 */
function swaprows ( A , i, j ) {
	if ( i != j ) {
		var ri = i*A.n;
		var rj = j*A.n;
		var tmp = vectorCopy(A.val.subarray(ri, ri+A.n));
		A.val.set(vectorCopy(A.val.subarray(rj, rj+A.n)), ri);
		A.val.set(tmp, rj);
	}
}
/**
 * @param {Matrix}
 */
function swapcols ( A , j, k ) {
	if ( j != k ) {
		var tmp = getCols ( A, [j]);
		setCols ( A, [j] , getCols ( A, [k]) );
		setCols ( A, [k], tmp);
	}
}

//////////////////////////
// Random numbers
////////////////////////////

// Gaussian random number (mean = 0, variance = 1;
//	Gaussian noise with the polar form of the Box-Muller transformation 
function randnScalar() {

    var x1;
    var x2;
    var w;
    var y1;
    var y2;
 	do {
	     x1 = 2.0 * Math.random() - 1.0;
	     x2 = 2.0 * Math.random() - 1.0;
	     w = x1 * x1 + x2 * x2;
	 } while ( w >= 1.0 );

	 w = Math.sqrt( (-2.0 * Math.log( w ) ) / w );
	 y1 = x1 * w;
	 y2 = x2 * w;
	 
	 return y1;
}
function randn( dim1, dim2 ) {
    var res;

	if ( typeof ( dim1 ) == "undefined" || (dim1 == 1 && typeof(dim2)=="undefined") || (dim1 == 1 && dim2==1)) {
		return randnScalar();		
	} 
	else if (typeof(dim2) == "undefined" || dim2 == 1 ) {
		res = new Float64Array(dim1);
		for (var i=0; i< dim1; i++) 			
			res[i] = randnScalar();
		
		return res;
	}
	else  {
		res = zeros(dim1, dim2);
		for (var i=0; i< dim1*dim2; i++) {
			res.val[i] = randnScalar();
		}
		return res;
	}
}

// Uniform random numbers
/*
 * @param{number}
 * @return{Float64Array}
 */
function randVector(dim1) {
	var res = new Float64Array(dim1);
	for (var i=0; i< dim1; i++) {			
		res[i] = Math.random();
	}
	return res;
}
/*
 * @param{number}
 * @param{number} 
 * @return{Matrix}
 */
function randMatrix(dim1,dim2) {
	const n = dim1*dim2;	
	var res = new Float64Array(n);
	for (var i=0; i< n; i++) {			
		res[i] = Math.random();
	}
	return new Matrix(dim1,dim2,res,true);
}
function rand( dim1, dim2 ) {
	var res;
	if ( typeof ( dim1 ) == "undefined" || (dim1 == 1 && typeof(dim2)=="undefined") || (dim1 == 1 && dim2==1)) {
		 return Math.random();
	} 
	else if (typeof(dim2) == "undefined" || dim2 == 1) {
		return randVector(dim1);
	}
	else  {
		return randMatrix(dim1,dim2);	
	}
}

function randnsparse(NZratio, dim1, dim2) {
	// Generates a sparse random matrix with NZratio * dim1*dim2 (or NZ if NZratio > 1 ) nonzeros
	var NZ;
	if ( NZratio > 1 )
		NZ = NZratio;
	else 
		NZ = Math.floor(NZratio *dim1*dim2);
		
	var indexes; 
	var i;
	var j;
	var k;
	var res;
	
	if ( typeof ( dim1 ) == "undefined" ) {
		return randn();
	} 
	else if (typeof(dim2) == "undefined" || dim2 == 1) {
	
		indexes = randperm( dim1 );
	
		res = zeros(dim1);
		for (i=0; i< NZ; i++) {
			res[indexes[i]] = randn();
		}
		return res;
	}
	else  {
		res = zeros(dim1, dim2);
		indexes = randperm( dim1*dim2 );
		for (k=0; k< NZ; k++) {
			i = Math.floor(indexes[k] / dim2);
			j = indexes[k] - i * dim2;
			res.val[i*dim2+j] = randn();		
		}
		return res;
	}
}
function randsparse(NZratio, dim1, dim2) {
	// Generates a sparse random matrix with NZratio * dim1*dim2 (or NZ if NZratio > 1 ) nonzeros
	if (typeof(dim2) == "undefined")
		var dim2 = 1;
	
	var NZ;
	if ( NZratio > 1 )
		NZ = NZratio;
	else 
		NZ = Math.floor(NZratio *dim1*dim2);
		
	var indexes; 
	var i;
	var j;
	var k;
	var res;
	
	if ( typeof ( dim1 ) == "undefined" ) {
		return randn();
	} 
	else if (dim2 == 1) {
	
		indexes = randperm( dim1 );
	
		res = zeros(dim1);
		for (i=0; i< NZ; i++) {
			res[indexes[i]] = Math.random();
		}
		return res;
	}
	else  {
		res = zeros(dim1, dim2);
		indexes = randperm( dim1*dim2 );

		for (k=0; k< NZ; k++) {
			i = Math.floor(indexes[k] / dim2);
			j = indexes[k] - i * dim2;
			res.val[i*dim2+j] = Math.random();			
		}
		return res;
	}
}

function randperm( x ) {
	// return a random permutation of x (or of range(x) if x is a number)

	if ( typeof( x ) == "number" ) {
		var perm = range(x); 
	}
	else {		
		var perm = new Float64Array(x);
	}
	var i;
	var j;
	var k;

	// shuffle	
	for(i=perm.length - 1 ; i > 1; i--) {
		j = Math.floor(Math.random() * i);
		k = perm[j];		
		perm[j] = perm[i];
		perm[i] = k;
	}
	return perm;
}
///////////////////////////////
/// Basic Math function: give access to Math.* JS functions 
///  and vectorize them 
///////////////////////////////


// automatically generate (vectorized) wrappers for Math functions
var MathFunctions = Object.getOwnPropertyNames(Math);
for ( var mf in MathFunctions ) {	
	if ( eval( "typeof(Math." + MathFunctions[mf] + ")") == "function") {
		if ( eval( "Math." + MathFunctions[mf] + ".length") == 1 ) {
			// this is a function of a scalar
			// make generic function:
			eval( MathFunctions[mf] + " = function (x) { return apply(Math."+ MathFunctions[mf] + " , x );};");
			// make vectorized version:
			eval( MathFunctions[mf] + "Vector = function (x) { return applyVector(Math."+ MathFunctions[mf] + " , x );};");
			// make matrixized version:
			eval( MathFunctions[mf] + "Matrix = function (x) { return applyMatrix(Math."+ MathFunctions[mf] + " , x );};");			
		}
	}
	else if (  eval( "typeof(Math." + MathFunctions[mf] + ")") == "number") {
		// Math constant: 
		eval( MathFunctions[mf] + " = Math."+ MathFunctions[mf] ) ;
	}
}

function apply( f, x ) {
	// Generic wrapper to apply scalar functions 
	// element-wise to vectors and matrices
	if ( typeof(f) != "function")
		return undefined;
	switch ( type( x ) ) {
	case "number":
		return f(x);
		break;
	case "Complex":
		var ComplexFunctions = ["exp", "abs"];
		var fc = ComplexFunctions.indexOf(f.name);
		if ( fc >= 0 )
			return eval(ComplexFunctions[fc] + "Complex(x);");
		else {
			error("This function has no Complex counterpart (yet).");
			return undefined;
		}
		break;
	case "vector":
		return applyVector(f, x);
		break;
	case "spvector":
		return applyspVector(f, x);
		break;
	case "ComplexVector":
		if ( f.name == "abs" )
			return absComplex(x);
		else
			return applyComplexVector(f, x);
		break;
	case "matrix":
		return applyMatrix(f, x);
		break;
	case "spmatrix":
		return applyspMatrix(f, x);
		break;
	case "ComplexMatrix":
		if ( f.name == "abs" )
			return absComplex(x);
		else
			return applyComplexMatrix(f, x);
		break;
	default: 
		return "undefined";
	}
}
function applyVector( f, x ) {
	const nv = x.length;
	var res = new Float64Array(nv);
	for (var i=0; i< nv; i++) 
		res[i] = f(x[i]);	
	return res;
}
function applyComplexVector( f, x ) {
	const nv = x.length;
	var res = new ComplexVector(nv);
	for (var i=0; i< nv; i++) 
		res.set(i, f(x.get(i) ) );	
	return res;
}
function applyComplexMatrix( f, x ) {
	const m = x.m;
	const n = x.n;
	var res = new ComplexMatrix(m, n);
	for (var i=0; i< m; i++) 
		for ( var j =0; j < n; j++)
			res.set(i, j, f(x.get(i,j) ) );
	return res;
}
function applyMatrix(f, x) {
	return new Matrix(x.m, x.n, applyVector(f, x.val), true);
}
///////////////////////////////
/// Operators
///////////////////////////////

function mul(a,b) {
	var sa = size(a);
	var sb = size(b); 
	if ( !isScalar(a) && sa[0] == 1 && sa[1] == 1 ) 
		a = get(a, 0, 0);
	if ( !isScalar(b) && sb[0] == 1 && sb[1] == 1 ) 
		b = get(b, 0, 0);

	switch( type(a) ) {
	case "number":
		switch( type(b) ) {
		case "number":
			return a*b;
			break;
		case "Complex":
			return mulComplexReal(b,a);
			break;
		case "vector":			
			return mulScalarVector(a,b);
			break;
		case "spvector":
			return mulScalarspVector(a,b);
			break;
		case "ComplexVector":			
			return mulScalarComplexVector(a,b);
			break;
		case "matrix":
			return mulScalarMatrix(a,b);
			break;
		case "spmatrix":
			return mulScalarspMatrix(a,b);
			break;
		case "ComplexMatrix":
			return mulScalarComplexMatrix(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "Complex":
		switch( type(b) ) {
		case "number":
			return mulComplexReal(a,b);
			break;
		case "Complex":
			return mulComplex(a,b);
			break;
		case "vector":			
			return mulComplexVector(a,b);
			break;
		case "ComplexVector":			
			return mulComplexComplexVector(a,b);
			break;
		case "spvector":
			return mulComplexspVector(a,b);
			break;
		case "matrix":
			return mulComplexMatrix(a,b);
			break;
		case "ComplexMatrix":
			return mulComplexComplexMatrix(a,b);
			break;
		case "spmatrix":
			return mulComplexspMatrix(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;		
	case "vector":
		switch( type(b) ) {
		case "number":
			return mulScalarVector(b,a);
			break;
		case "Complex":			
			return mulComplexVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dot(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dotspVectorVector(b,a);
			break;
		case "ComplexVector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dotComplexVectorVector(b,a);
			break;		
		case "matrix":
			if ( b.m == 1) 
				return outerprodVectors(a , b.val );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		case "spmatrix":
			if ( b.m == 1) 
				return outerprodVectors(a , fullMatrix(b).val );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		case "ComplexMatrix":
			if ( b.m == 1) 
				return transpose(outerprodComplexVectorVector(new ComplexVector(b.re,b.im,true), a , b.val ));
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "spvector":
		switch( type(b) ) {
		case "number":
			return mulScalarspVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dotspVectorVector(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return spdot(b,a);
			break;
		case "matrix":
			if ( b.m == 1) 
				return outerprodspVectorVector(a , b.val );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		case "spmatrix":
			if ( b.m == 1) 
				return outerprodspVectorVector(a, fullMatrix(b).val);
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "ComplexVector":
		switch( type(b) ) {
		case "number":
			return mulScalarComplexVector(b,a);
			break;
		case "Complex":
			return mulComplexComplexVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dotComplexVectorVector(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in mul(a,b) (dot product): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return dotComplexVectorspVector(a,b);
			break;
		case "matrix":
			if ( b.m == 1) 
				return outerprodComplexVectorVector(a , b.val );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		case "spmatrix":
			if ( b.m == 1) 
				return outerprodComplexVectorVector(a , fullMatrix(b).val );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		case "ComplexMatrix":
			if ( b.m == 1) 
				return outerprodComplexVectors(a , new ComplexVector(b.re,b.im, true) );
			else {
				error("Inconsistent dimensions in mul(a,B): size(a) = [" + sa[0] + "," + sa[1] + "], size(B) = [" + sb[0] + "," + sb[1] + "]");
				return undefined;
			}
			break;
		default:
			return undefined;
			break;
		}
		break;
		
	case "matrix":
		switch( type(b) ) {
		case "number":
			return mulScalarMatrix(b,a);
			break;
		case "Complex":
			return mulComplexMatrix(b,a);
			break;
		case "vector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dot(a.val, b);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulMatrixVector(a,b);
			}
			break;
		case "spvector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotspVectorVector(b, a.val);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulMatrixspVector(a,b);
			}
			break;
		case "ComplexVector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotComplexVectorVector(b, a.val);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulMatrixComplexVector(a,b);
			}
			break;
		case "matrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulMatrixspMatrix(a,b);
			break;
		case "ComplexMatrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return transpose(mulComplexMatrixMatrix(transpose(b),transpose(a)));
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "spmatrix":
		switch( type(b) ) {
		case "number":
			return mulScalarspMatrix(b,a);
			break;
		case "vector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.n != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dot(fullMatrix(a).val, b);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulspMatrixVector(a,b);
			}
			break;
		case "spvector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.n != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotspVectorVector(b, fullMatrix(a).val);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulspMatrixspVector(a,b);
			}
			break;
		case "matrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulspMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulspMatrixspMatrix(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "ComplexMatrix":
		switch( type(b) ) {
		case "number":
			return mulScalarComplexMatrix(b,a);
			break;
		case "Complex":
			return mulComplexComplexMatrix(b,a);
			break;
		case "vector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotComplexVectorVector(new ComplexVector(a.re,a.im,true), b);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulComplexMatrixVector(a,b);
			}
			break;
		case "spvector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotComplexVectorspVector(new ComplexVector(a.re,a.im,true), b);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulComplexMatrixspVector(a,b);
			}
			break;
		case "ComplexVector":
			if ( a.m == 1 ) {
				// dot product with explicit transpose
				if ( a.val.length != b.length ) {
					error("Error in mul(a',b): a.length = " + a.val.length + " != " + b.length + " =  b.length.");
					return undefined; 
				}
				return dotComplexVectors(new ComplexVector(a.re,a.im,true), b);
			}
			else {			
				if ( a.n != b.length ) {
					error("Error in mul(A,b): A.n = " + a.n + " != " + b.length + " = b.length.");
					return undefined; 
				}
				return mulComplexMatrixComplexVector(a,b);
			}
			break;
		case "matrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulComplexMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulComplexMatrixspMatrix(a,b);
			break;
		case "ComplexMatrix":
			if ( a.n != b.m ) {
				error("Error in mul(A,B): A.n = " + a.n + " != " + b.m + " = B.m.");
				return undefined; 
			}
			return mulComplexMatrices(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;
	default:
		return undefined;
		break;
	}
}

/**
 * @param {number}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function mulScalarVector( scalar, vec ) {
	var i;
	const n = vec.length;
	var res = new Float64Array(vec);
	for ( i=0; i < n; i++)
		res[i] *= scalar ;
	return res;
}
/**
 * @param {number}
 * @param {Matrix}
 * @return {Matrix} 
 */
function mulScalarMatrix( scalar, A ) {
	var res = new Matrix(A.m,A.n, mulScalarVector(scalar, A.val), true );

	return res;	
}

/**
 * @param {Float64Array}
 * @param {Float64Array}
 * @return {number} 
 */
function dot(a, b) {
	const n = a.length;
	var i;
	var res = 0;
	for ( i=0; i< n; i++) 
		res += a[i]*b[i];
	return res;
}

/**
 * @param {Matrix}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function mulMatrixVector( A, b ) {
	const m = A.length;
	var c = new Float64Array(m); 	
	var r = 0;
	for (var i=0; i < m; i++) {
		c[i] = dot(A.val.subarray(r, r+A.n), b);
		r += A.n;
	}
	
	return c;
}
/**
 * @param {Matrix}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function mulMatrixTransVector( A, b ) {
	const m = A.length;
	const n = A.n;
	var c = new Float64Array(n); 	
	var rj = 0;
	for (var j=0; j < m; j++) {
		var bj = b[j];
		for (var i=0; i < n; i++) {
			c[i] += A.val[rj + i] * bj;			
		}
		rj += A.n;
	}
	return c;
}
/**
 * @param {Matrix}
 * @param {Matrix}
 * @return {Matrix} 
 */
function mulMatrixMatrix(A, B) {
	const m = A.length;
	const n = B.n;
	const n2 = B.length;
	
	var Av = A.val; 
	var Bv = B.val;
	
	var C = new Float64Array(m*n);
	var aik;
	var Aik = 0;
	var Ci = 0;
	for (var i=0;i < m ; i++) {		
		var bj = 0;
		for (var k=0; k < n2; k++ ) {
			aik = Av[Aik];
			for (var j =0; j < n; j++) {
				C[Ci + j] += aik * Bv[bj];
				bj++;
			}	
			Aik++;					
		}
		Ci += n;
	}
	return  new Matrix(m,n,C, true);	
}
/**
 * @param {Float64Array}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function entrywisemulVector( a, b) {
	var i;
	const n = a.length;
	var res = new Float64Array(n);
	for ( i=0; i < n; i++)
		res[i] = a[i] * b[i];
	return res;
}
/**
 * @param {Matrix}
 * @param {Matrix}
 * @return {Matrix} 
 */
function entrywisemulMatrix( A, B) {
	var res = new Matrix(A.m,A.n, entrywisemulVector(A.val, B.val), true );	
	return res;
}


function entrywisemul(a,b) {
	var sa = size(a);
	var sb = size(b); 
	if (typeof(a) != "number" && sa[0] == 1 && sa[1] == 1 ) 
		a = get(a, 0, 0);
	if (typeof(b) != "number" && sb[0] == 1 && sb[1] == 1 ) 
		b = get(b, 0, 0);

	switch( type(a) ) {
	case "number":
		switch( type(b) ) {
		case "number":
			return a*b;
			break;
		case "Complex":
			return mulComplexReal(b,a);
			break;
		case "vector":			
			return mulScalarVector(a,b);
			break;
		case "spvector":
			return mulScalarspVector(a,b);
			break;
		case "ComplexVector":
			return mulScalarComplexVector(b,a);
			break;
		case "matrix":
			return mulScalarMatrix(a,b);
			break;
		case "spmatrix":
			return mulScalarspMatrix(a,b);
			break;
		case "ComplexMatrix":
			return mulScalarComplexMatrix(b,a);
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "vector":
		switch( type(b) ) {
		case "number":
			return mulScalarVector(b,a);
			break;
		case "Complex":
			return mulComplexVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulVector(a,b);
			break;
		case "ComplexVector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulComplexVectorVector(b,a);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulspVectorVector(b,a);
			break;
		case "matrix":
		case "spmatrix":
		case "ComplexMatrix":
			error("Error in entrywisemul(a,B): a is a vector and B is a matrix.");
			return undefined;			
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "spvector":
		switch( type(b) ) {
		case "number":
			return mulScalarspVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulspVectorVector(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulspVectors(a,b);
			break;
		case "matrix":
			error("Error in entrywisemul(a,B): a is a vector and B is a Matrix.");
			return undefined;		
			break;
		case "spmatrix":
			error("Error in entrywisemul(a,B): a is a vector and B is a Matrix.");
			return undefined;		
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "matrix":
		switch( type(b) ) {
		case "number":
			return mulScalarMatrix(b,a);
			break;
		case "Complex":
			return mulComplexMatrix(b,a);
			break;
		case "vector":
		case "spvector":
		case "ComplexVector":
			error("Error in entrywisemul(A,b): A is a Matrix and b is a vector.");
			return undefined;
			break;
		case "matrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulspMatrixMatrix(b,a);
			break;
		case "ComplexMatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulComplexMatrixMatrix(b,a);
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "spmatrix":
		switch( type(b) ) {
		case "number":
			return mulScalarspMatrix(b,a);
			break;
		case "vector":
			error("Error in entrywisemul(A,b): A is a Matrix and b is a vector.");
			return undefined;
			break;
		case "spvector":
			error("Error in entrywisemul(A,b): A is a Matrix and b is a vector.");
			return undefined;
			break;
		case "matrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulspMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulspMatrices(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "ComplexVector":
		switch( type(b) ) {
		case "number":
			return mulScalarComplexVector(b,a);
			break;
		case "Complex":
			return mulComplexComplexVector(b,a);
			break;
		case "vector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulComplexVectorVector(a,b);
			break;
		case "ComplexVector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulComplexVectors(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in entrywisemul(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined; 
			}	
			return entrywisemulComplexVectorspVector(a,b);
			break;
		case "matrix":
		case "spmatrix":
		case "ComplexMatrix":
			error("Error in entrywisemul(a,B): a is a vector and B is a matrix.");
			return undefined;			
			break;
		default:
			return undefined;
			break;
		}
		break;
	case "ComplexMatrix":
		switch( type(b) ) {
		case "number":
			return mulScalarComplexMatrix(b,a);
			break;
		case "Complex":
			return mulComplexComplexMatrix(b,a);
			break;
		case "vector":
		case "spvector":
		case "ComplexVector":
			error("Error in entrywisemul(A,b): A is a Matrix and b is a vector.");
			return undefined;
			break;
		case "matrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulComplexMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulComplexMatrixspMatrix(a,b);
			break;
		case "ComplexMatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in entrywisemul(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return entrywisemulComplexMatrices(a,b);
			break;
		default:
			return undefined;
			break;
		}
		break;
	default:
		return undefined;
		break;
	}
}


/** SAXPY : y = y + ax
 * @param {number}
 * @param {Float64Array}
 * @param {Float64Array}
 */
function saxpy ( a, x, y) {
	const n = y.length;
	for ( var i=0; i < n; i++) 
		y[i] += a*x[i];
}
/** GAXPY : y = y + Ax
 * @param {Matrix}
 * @param {Float64Array}
 * @param {Float64Array}
 */
function gaxpy ( A, x, y) {
	const m = A.m;
	const n = A.n;
	var r = 0;
	for ( var i=0; i < m; i++) {
		y[i] += dot(A.val.subarray(r, r + n),x);
		r += n;
	}
}

/**
 * @param {Float64Array}
 * @param {number}
 * @return {Float64Array} 
 */
function divVectorScalar( a, b) {
	var i;
	const n = a.length;
	var res = new Float64Array(a);
	for ( i=0; i < n; i++)
		res[i] /= b;
	return res;
}
/**
 * @param {number}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function divScalarVector ( a, b) {
	var i;
	const n = b.length;
	var res = new Float64Array(n);
	for ( i=0; i < n; i++)
		res[i] = a / b[i];
	return res;
}
/**
 * @param {Float64Array}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function divVectors( a, b) {
	var i;
	const n = a.length;
	var res = new Float64Array(a);
	for ( i=0; i < n; i++)
		res[i] /= b[i];
	return res;
}
/**
 * @param {Matrix}
 * @param {number}
 * @return {Matrix} 
 */
function divMatrixScalar( A, b) {
	var res = new Matrix(A.m, A.n, divVectorScalar(A.val , b ), true);
	return res;
}
/**
 * @param {number}
 * @param {Matrix}
 * @return {Matrix} 
 */
function divScalarMatrix( a, B) {
	var res = new Matrix(B.m, B.n, divScalarVector(a, B.val ), true);
	return res;
}
/**
 * @param {Matrix}
 * @param {Matrix}
 * @return {Matrix} 
 */
function divMatrices( A, B) {
	var res = new Matrix(A.m, A.n, divVectors(A.val, B.val ), true);
	return res;
}

function entrywisediv(a,b) {
	var ta = type(a);
	var tb = type(b); 

	switch(ta) {
		case "number": 
			switch(tb) {
			case "number":
				return a/b;
				break;
			case "vector":
				return divScalarVector(a,b);
				break;
			case "matrix":
				return divScalarMatrix(a,b);
				break;
			case "spvector":
				return divScalarspVector(a,b);
				break;
			case "spmatrix":
				return divScalarspMatrix(a,b);
				break;
			default:
				error("Error in entrywisediv(a,b): b must be a number, a vector or a matrix.");
				return undefined;
			}
			break;
		case "vector": 
			switch(tb) {
			case "number":
				return divVectorScalar(a,b);
				break;
			case "vector":
				if ( a.length != b.length ) {
					error("Error in entrywisediv(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
					return undefined;
				}
				return divVectors(a,b);
				break;
			case "spvector":
				error("Error in entrywisediv(a,b): b is a sparse vector with zeros.");
				break;
			default:
				error("Error in entrywisediv(a,B): a is a vector and B is a " + tb + ".");
				return undefined;
			}
			break;
		case "spvector": 
			switch(tb) {
			case "number":
				return mulScalarspVector(1/b, a);
				break;
			case "vector":
				if ( a.length != b.length ) {
					error("Error in entrywisediv(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
					return undefined;
				}
				return divVectorspVector(a,b);
				break;
			case "spvector":
				error("Error in entrywisediv(a,b): b is a sparse vector with zeros.");
				return undefined;
				break;
			default:
				error("Error in entrywisediv(a,B): a is a vector and B is a " + tb + ".");
				return undefined;
			}
			break;
		case "matrix": 
			switch(tb) {
			case "number":
				return divMatrixScalar(a,b);
				break;
			case "matrix":
				if ( a.m != b.m || a.n != b.n ) {
					error("Error in entrywisediv(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
					return undefined;
				}
				return divMatrices(a,b);
				break;
			case "spmatrix":
				error("Error in entrywisediv(A,B): B is a sparse matrix with zeros.");
				return undefined;
				break;
			default:
				error("Error in entrywisediv(A,b): a is a matrix and B is a " + tb + ".");
				return undefined;
			}
		case "spmatrix": 
			switch(tb) {
			case "number":
				return mulScalarspMatrix(1/b,a);
				break;
			case "matrix":
				if ( a.m != b.m || a.n != b.n ) {
					error("Error in entrywisediv(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
					return undefined;
				}
				return divMatrixspMatrix(a,b);
				break;
			case "spmatrix":
				error("Error in entrywisediv(A,B): B is a sparse matrix with zeros.");
				return undefined;
				break;
			default:
				error("Error in entrywisediv(A,b): a is a matrix and B is a " + tb + ".");
				return undefined;
			}
			break;
		default:
			error("Error in entrywisediv(a,b): a must be a number, a vector or a matrix.");
			return undefined;
			break;
	}
}

function outerprodVectors(a, b, scalar) {
	var i;
	var j;
	var ui;
	const m = a.length;
	const n = b.length;
	var res = new Matrix(m,n);
	if( arguments.length == 3 ) {
		for (i=0; i< m; i++) 
			res.val.set( mulScalarVector(scalar*a[i], b), i*n);	
	}
	else {
		for (i=0; i< m; i++) 
			res.val.set( mulScalarVector(a[i], b), i*n);	
	}
	return res;
}
function outerprod( u , v, scalar ) {
	// outer product of two vectors : res = scalar * u * v^T

	if (typeof(u) == "number" ) {
		if ( typeof(v) == "number" ) {
			if ( arguments.length == 2 )
				return u*v;
			else
				return u*v*scalar;
		}
		else {
			if ( arguments.length == 2 )
				return new Matrix(1,v.length, mulScalarVector(u, v), true );
			else
				return new Matrix(1,v.length, mulScalarVector(u*scalar, v), true ); 
		}
	}
	if ( u.length == 1 ) {
		if ( typeof(v) == "number" ) {
			if ( arguments.length == 2 )
				return u[0]*v;
			else
				return u[0]*v*scalar;
		}
		else  {
			if ( arguments.length == 2 )
				return new Matrix(1,v.length, mulScalarVector(u[0], v) , true);
			else
				return new Matrix(1,v.length, mulScalarVector(u[0]*scalar, v), true ); 
		}
	}
	if (typeof(v) == "number" ) {
		if (arguments.length == 2 ) 
			return mulScalarVector(v, u);
		else
			return mulScalarVector( scalar * v , u);
	}
	if ( v.length == 1) {
		if ( arguments.length == 2 )
			return mulScalarVector(v[0], u);
		else
			return mulScalarVector( scalar * v[0] , u);
	}
	
	if ( arguments.length == 2 )
		return outerprodVectors(u,v);
	else
		return outerprodVectors(u,v, scalar);
}
/**
 * @param {number}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function addScalarVector ( scalar, vec ) {
	const n = vec.length;
	var res = new Float64Array(vec);
	for (var i = 0 ; i< n; i++) 
		res[i] += scalar ;
	
	return res;
}
/**
 * @param {number}
 * @param {Matrix}
 * @return {Matrix} 
 */
function addScalarMatrix(a, B ) {
	return new Matrix(B.m, B.n, addScalarVector(a, B.val), true );
}
/**
 * @param {Float64Array}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function addVectors(a,b) {
	const n = a.length;
	var c = new Float64Array(a);
	for (var i=0; i < n; i++)
		c[i] += b[i];
	return c;
}
/**
 * @param {Matrix}
 * @param {Matrix}
 * @return {Matrix} 
 */
function addMatrices(A,B) {
	return new Matrix(A.m, A.n, addVectors(A.val, B.val) , true);
}
function add(a,b) {
	
	const ta = type(a);
	const tb = type(b);
	if ( ta == "number" && tb == "number" || ta == "string" || tb == "string")
		return a + b;
	else if ( ta == "number") {
		switch(tb) {
		case "Complex":
			return addComplexReal(b,a);
			break;
		case "vector":
			return addScalarVector(a,b); 
			break;
		case "matrix":
			return addScalarMatrix(a,b);
			break;
		case "spvector":
			return addScalarspVector(a,b); 
			break;
		case "spmatrix":
			return addScalarspMatrix(a,b);
			break;
		case "ComplexVector":
			return addScalarComplexVector(a,b); 
			break;
		case "ComplexMatrix":
			return addScalarComplexMatrix(a,b); 
			break;
		default:
			return undefined;
			break;			
		}
	}
	else if ( tb == "number" ) {
		switch(ta) {
		case "Complex":
			return addComplexReal(a,b);
			break;
		case "vector":
			return addScalarVector(b,a); 
			break;
		case "matrix":
			return addScalarMatrix(b,a);
			break;
		case "spvector":
			return addScalarspVector(b,a); 
			break;
		case "spmatrix":
			return addScalarspMatrix(b,a);
			break;
		case "ComplexVector":
			return addScalarComplexVector(b,a); 
			break;
		case "ComplexMatrix":
			return addScalarComplexMatrix(b,a); 
			break;
		default:
			return undefined;
			break;			
		}
	}
	else if ( ta == "vector" ) {
		switch(tb) {
		case "vector":
			// vector addition
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addVectors(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addVectorspVector(a,b);
			break;
		case "ComplexVector":
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addComplexVectorVector(b,a);
			break;
		case "matrix":
		case "spmatrix":
		default:
			error("Error in add(a,B): a is a vector and B is a " + tb + ".");
			return undefined;
			break;			
		}
	}
	else if ( ta == "matrix" ) {
		switch(tb) {
		case "matrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addMatrices(a,b);
			break;
		case "spmatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addMatrixspMatrix(a,b);
			break;
		case "ComplexMatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addComplexMatrixMatrix(b,a);
			break;
		case "vector":
		case "spvector":
		default:
			error("Error in add(A,b): a is a matrix and B is a " + tb + ".");
			return undefined;
			break;			
		}		
	}
	else if ( ta == "spvector" ) {
		switch(tb) {
		case "vector":
			// vector addition
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addVectorspVector(b,a);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addspVectors(a,b);
			break;
		case "matrix":
		case "spmatrix":
		default:
			error("Error in add(a,B): a is a sparse vector and B is a " + tb + ".");
			return undefined;
			break;			
		}
	}
	else if ( ta == "spmatrix" ) {
		switch(tb) {
		case "matrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addMatrixspMatrix(b,a);
			break;
		case "spmatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addspMatrices(a,b);
			break;
		case "vector":
		case "spvector":
		default:
			error("Error in add(A,b): a is a sparse matrix and B is a " + tb + ".");
			return undefined;
			break;			
		}		
	}
	else if ( ta == "ComplexVector" ) {
		switch(tb) {
		case "vector":
			// vector addition
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addComplexVectorVector(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addComplexVectorspVector(a,b);
			break;
		case "ComplexVector":
			if ( a.length != b.length ) {
				error("Error in add(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return addComplexVectors(b,a);
			break;
		case "matrix":
		case "spmatrix":
		default:
			error("Error in add(a,B): a is a vector and B is a " + tb + ".");
			return undefined;
			break;			
		}
	}
	else if ( ta == "ComplexMatrix" ) {
		switch(tb) {
		case "matrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addComplexMatrixMatrix(a,b);
			break;
		case "spmatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addComplexMatrixspMatrix(a,b);
			break;
		case "ComplexMatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in add(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return addComplexMatrices(a,b);
			break;
		case "vector":
		case "spvector":
		default:
			error("Error in add(A,b): a is a matrix and B is a " + tb + ".");
			return undefined;
			break;			
		}		
	}
	else
		return undefined;
}
/**
 * @param {number}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function subScalarVector ( scalar, vec ) {
	const n = vec.length;
	var res = new Float64Array(n);
	for (var i = 0 ; i< n; i++) 
		res[i] = scalar - vec[i];		
	
	return res;
}
/**
 * @param {Float64Array}
 * @param {number}
 * @return {Float64Array} 
 */
function subVectorScalar ( vec, scalar ) {
	const n = vec.length;
	var res = new Float64Array(vec);
	for (var i = 0 ; i< n; i++) 
		res[i] -= scalar;
	
	return res;
}
/**
 * @param {number}
 * @param {Matrix} 
 * @return {Matrix} 
 */
function subScalarMatrix(a, B ) {
	return new Matrix(B.m, B.n, subScalarVector(a, B.val), true );
}
/**
 * @param {Matrix}
 * @param {number} 
 * @return {Matrix} 
 */
function subMatrixScalar(B, a ) {
	return new Matrix(B.m, B.n, subVectorScalar(B.val, a) , true);
}
/**
 * @param {Float64Array}
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function subVectors(a,b) {
	const n = a.length;
	var c = new Float64Array(a);
	for (var i=0; i < n; i++)
		c[i] -= b[i];
	return c;
}
/**
 * @param {Matrix}
 * @param {Matrix} 
 * @return {Matrix} 
 */
function subMatrices(A,B) {
	return new Matrix(A.m, A.n, subVectors(A.val, B.val), true );
}
function sub(a,b) {
	
	const ta = type(a);
	const tb = type(b);
	if ( ta == "number" && tb == "number" )
		return a - b;
	else if ( ta == "number") {
		switch(tb) {
		case "Complex":
			return addComplexReal(minusComplex(b),a);
			break;
		case "vector":
			return subScalarVector(a,b); 
			break;
		case "matrix":
			return subScalarMatrix(a,b);
			break;
		case "spvector":
			return subScalarspVector(a,b); 
			break;
		case "spmatrix":
			return subScalarspMatrix(a,b);
			break;
		default:
			return undefined;
			break;			
		}
	}
	else if ( tb == "number" ) {
		switch(ta) {
		case "Complex":
			return addComplexReal(b,-a);
			break;
		case "vector":
			return subVectorScalar (a, b);
			break;
		case "matrix":
			return subMatrixScalar(a,b);
			break;
		case "spvector":
			return addScalarspVector(-b,a); 
			break;
		case "spmatrix":
			return addScalarspMatrix(-b,a);
			break;
		default:
			return undefined;
			break;			
		}		
	}
	else if ( ta == "vector" ) {
		switch(tb) {
		case "vector":
			// vector substraction
			if ( a.length != b.length ) {
				error("Error in sub(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return subVectors(a,b);
			break;
		case "spvector":
			// vector substraction
			if ( a.length != b.length ) {
				error("Error in sub(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return subVectorspVector(a,b);
			break;
		case "matrix":
		case "spmatrix":
		default:
			error("Error in sub(a,B): a is a vector and B is a " + tb + ".");
			return undefined;
			break;			
		}		
	}
	else if ( ta == "matrix" ) {
		switch(tb) {
		case "matrix":
			// Matrix sub
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in sub(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return subMatrices(a,b);
			break;
		case "spmatrix":
			// Matrix addition
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in sub(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return subMatrixspMatrix(a,b);
			break;
		case "vector":
		case "spvector":
		default:
			error("Error in sub(A,b): A is a matrix and b is a " + tb + ".");
			return undefined;
			break;			
		}	
	}
	else if ( ta == "spvector" ) {
		switch(tb) {
		case "vector":
			if ( a.length != b.length ) {
				error("Error in sub(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return subspVectorVector(a,b);
			break;
		case "spvector":
			if ( a.length != b.length ) {
				error("Error in sub(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			return subspVectors(a,b);
			break;
		case "matrix":
		case "spmatrix":
		default:
			error("Error in sub(a,B): a is a sparse vector and B is a " + tb + ".");
			return undefined;
			break;			
		}
	}
	else if ( ta == "spmatrix" ) {
		switch(tb) {
		case "matrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in sub(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return subspMatrixMatrix(a,b);
			break;
		case "spmatrix":
			if ( a.m != b.m || a.n != b.n ) {
				error("Error in sub(A,B): size(A) = [" + a.m + "," + a.n + "] != [" + b.m + "," + b.n + "] = size(B).");
				return undefined;
			}
			return subspMatrices(a,b);
			break;
		case "vector":
		case "spvector":
		default:
			error("Error in sub(A,b): a is a sparse matrix and B is a " + tb + ".");
			return undefined;
			break;			
		}		
	}
	else
		return undefined;
}

function pow(a,b) {
	var i;
	const ta = type(a);
	const tb = type(b);
	
	if ( ta == "number" && tb == "number" )
		return Math.pow(a, b);
	else if ( ta == "number") {
		if ( tb == "vector" ) {
			var c = zeros(b.length);
			if ( !isZero(a) ) {
				for (i=0;i<b.length;i++) {
					c[i] = Math.pow(a, b[i]);					
				}
			}
			return c;
		}
		else {
			var c = new Matrix( b.m, b.n, pow(a, b.val), true);
			return c;
		}	
	}
	else if ( tb == "number" ) {
		if ( ta == "vector" ) {			
			var c = zeros(a.length);
			for (i=0; i < a.length; i++)
				c[i] = Math.pow(a[i], b);
			return c;
		}
		else {			
			var c = new Matrix( a.m, a.n, pow(a.val, b), true);
			return c;
		}
	}
	else if ( ta == "vector" ) {
		if ( tb == "vector" ) {
			// entry-wise power
			if ( a.length != b.length ) {
				error("Error in pow(a,b): a.length = " + a.length + " != " + b.length + " = b.length.");
				return undefined;
			}
			var c = zeros(a.length);
			for ( i=0; i<a.length; i++ ) {
				c[i] = Math.pow(a[i], b[i]);
			}
			return c;
		}
		else {
			// vector + matrix
			return "undefined";
		}
	}
	else {
		if ( tb == "vector" ) {
			// matrix + vector 
			return "undefined";
		}
		else {
			// entry-wise power
			var c = new Matrix( a.m, a.n, pow(a.val, b.val), true);
			return c;
		}
	}
}

function minus ( x ) {
	
	switch(type(x)) {
	case "number":
		return -x;
		break;
	case "vector":
		return minusVector(x);
		break;
	case "spvector":
		return new spVector(x.length, minusVector(x.val), x.ind );		
		break;
	case "ComplexVector":
		return minusComplexVector(x);
		break;
	case "matrix":
		return new Matrix(x.m, x.n, minusVector(x.val), true );		
		break;
	case "spmatrix":
		return new spMatrix(x.m, x.n, minusVector(x.val), x.cols, x.rows );		
		break;
	case "ComplexMatrix":
		return minusComplexMatrix(x);
		break;
	default:
		return undefined;
	}
}
/**
 * @param {Float64Array}
 * @return {Float64Array} 
 */
function minusVector( x ) {
	var res = new Float64Array(x.length);
	for (var i =0; i < x.length; i++)
		res[i] = -x[i];	
	return res;
}
/**
 * @param {Matrix}
 * @return {Matrix} 
 */
function minusMatrix( x ) {
	return new Matrix(x.m, x.n, minusVector(x.val), true );		
}
// minimum

/**
 * @param {Float64Array}
 * @return {number} 
 */
function minVector( a ) {
	const n = a.length;
	var res = a[0];
	for (var i = 1; i < n ; i++) {
		if ( a[i] < res)
			res = a[i];
	}
	return res; 
}
/**
 * @param {Matrix}
 * @return {number} 
 */
function minMatrix( A ) {	
	return minVector(A.val);
}
/**
 * @param {Float64Array}
 * @param {number}
 * @return {Float64Array} 
 */
function minVectorScalar(vec, scalar ) {
	var n = vec.length;
	var res = new Float64Array(vec);
	for (var i = 0; i < n ; i++) {
		if ( scalar < vec[i])
			res[i] = scalar;
	}
	return res; 
}
/**
 * @param {Matrix}
 * @param {number}
 * @return {Matrix} 
 */
function minMatrixScalar(A, scalar ) {
	return new Matrix(A.m, A.n, minVectorScalar(A.val, scalar), true);
}
/**
 * @param {Matrix}
 * @return {Matrix} 
 */
function minMatrixRows( A ) {
	const m = A.m;
	const n = A.n;
	var res = new Float64Array(A.val.subarray(0,n) );
	var j;
	var r = n;
	for ( var i=1; i < m; i++) {
		for ( j = 0; j < n; j++) 
			if( A.val[r + j] < res[j])
				res[j] = A.val[r + j];
		r += n;		
	}
	return new Matrix(1,n,res, true);
}
/**
 * @param {Matrix}
 * @return {Float64Array} 
 */
function minMatrixCols( A ) {
	var m = A.m;
	var res = new Float64Array(m);
	var r = 0;
	for ( var i=0; i < m; i++) {
		res[i] = minVector(A.val.subarray(r, r+A.n) );
		r += A.n;
	}
	return res;
}
/**
 * @param {Float64Array}
 * @param {Float64Array} 
 * @return {Float64Array} 
 */
function minVectorVector(a, b) {
	const n = a.length;
	var res = new Float64Array(a);
	for (var i = 0; i < n ; i++) {
		if ( b[i] < a[i])
			res[i] = b[i];
	}
	return res; 
}
/**
 * @param {Matrix}
 * @param {Matrix} 
 * @return {Matrix} 
 */
function minMatrixMatrix( A, B ) {
	return new Matrix(A.m, A.n, minVectorVector(A.val, B.val), true);
}
function min(a,b) {
	var ta = type(a);
	
	if ( arguments.length == 1 ) {
		switch( ta ) {
		case "vector":
			return minVector(a);
			break;
		case "spvector":
			var m = minVector(a.val);
			if ( m > 0 && a.val.length < a.length )
				return 0;
			else
				return m;
			break;
		case "matrix":
			return minMatrix(a);
			break;
		case "spmatrix":
			var m = minVector(a.val);
			if ( m > 0 && a.val.length < a.m * a.n )
				return 0;
			else
				return m;
			break;
		default:
			return a;
			break;
		}
	}

	var tb = type(b); 
	if (ta == "spvector" ) {
		a = fullVector(a);
		ta = "vector";
	}
	if (ta == "spmatrix" ) {
		a = fullMatrix(a);
		ta = "matrix";
	}
	if (tb == "spvector" ) {
		b = fullVector(b);
		tb = "vector";
	}
	if (tb == "spmatrix" ) {
		b = fullMatrix(b);
		tb = "matrix";
	}

	if ( ta == "number" && tb == "number" ) 
		return Math.min(a,b);
	else if ( ta == "number") {
		if ( tb == "vector" )  
			return minVectorScalar(b, a ) ;
		else 
			return minMatrixScalar(b, a ) ;
	}	
	else if ( tb == "number" ) {
		if ( ta == "vector" ) 
			return minVectorScalar(a, b);
		else {
			// MAtrix , scalar 
			if ( b == 1) 
				return minMatrixRows(a); // return row vector of min of columns
			else if ( b == 2 ) 
				return minMatrixCols(a); // return column vector of min of rows
			else 
				return minMatrixScalar(a, b);
		}
	}
	else if ( ta == "vector" ) {
		if ( tb == "vector" ) 
			return minVectorVector(a,b);
		else 
			return "undefined";
	}
	else {
		if ( tb == "matrix" ) 
			return minMatrixMatrix(a,b);
		else 
			return "undefined";				
	}
}

// maximum
/**
 * @param {Float64Array}
 * @return {number} 
 */
function maxVector( a ) {
	const n = a.length;
	var res = a[0];
	for (var i = 1; i < n ; i++) {
		if ( a[i] > res)
			res = a[i];
	}
	return res; 
}
/**
 * @param {Matrix}
 * @return {number} 
 */
function maxMatrix( A ) {
	return maxVector(A.val);
}
/**
 * @param {Float64Array}
 * @param {number} 
 * @return {Float64Array} 
 */
function maxVectorScalar(vec, scalar ) {
	const n = vec.length;
	var res = new Float64Array(vec);
	for (var i = 0; i < n ; i++) {
		if ( scalar > vec[i])
			res[i] = scalar;
	}
	return res; 
}
/**
 * @param {Matrix}
 * @param {number} 
 * @return {Matrix} 
 */
function maxMatrixScalar(A, scalar ) {
	return maxVectorScalar(A.val, scalar);
}
/**
 * @param {Matrix}
 * @return {Matrix} 
 */
function maxMatrixRows( A ) {
	const m = A.m;
	const n = A.n;
	var res = new Float64Array(A.val.subarray(0,n) );
	var j;
	var r = n;
	for ( var i=1; i < m; i++) {
		for ( j = 0; j < n; j++) 
			if( A.val[r + j] > res[j])
				res[j] = A.val[r + j];
		r += n;		
	}
	return new Matrix(1,n,res,true);
}
/**
 * @param {Matrix}
 * @return {Float64Array} 
 */
function maxMatrixCols( A ) {
	const m = A.m;
	var res = new Float64Array(m);
	var r = 0;
	for ( var i=0; i < m; i++) {
		res[i] = maxVector(A.val.subarray(r, r+A.n) );
		r += A.n;
	}
	return res;
}
/**
 * @param {Float64Array}
 * @param {Float64Array} 
 * @return {Float64Array} 
 */
function maxVectorVector(a, b) {
	var n = a.length;
	var res = new Float64Array(a);
	for (var i = 0; i < n ; i++) {
		if ( b[i] > a[i])
			res[i] = b[i];
	}
	return res; 
}
/**
 * @param {Matrix}
 * @param {Matrix} 
 * @return {Matrix} 
 */
function maxMatrixMatrix( A, B ) {
	return new Matrix(A.m, A.n, maxVectorVector(A.val, B.val), true);
}
function max(a,b) {
	var ta = type(a);

	if ( arguments.length == 1 ) {
		switch( ta ) {
		case "vector":
			return maxVector(a);
			break;
		case "spvector":
			var m = maxVector(a.val);
			if ( m < 0 && a.val.length < a.length )
				return 0;
			else
				return m;
			break;
		case "matrix":
			return maxMatrix(a);
			break;
		case "spmatrix":
			var m = maxVector(a.val);
			if ( m < 0 && a.val.length < a.m * a.n )
				return 0;
			else
				return m;
			break;
		default:
			return a;
			break;
		}
	}

	var tb = type(b); 
	if (ta == "spvector" ) {
		a = fullVector(a);
		ta = "vector";
	}
	if (ta == "spmatrix" ) {
		a = fullMatrix(a);
		ta = "matrix";
	}
	if (tb == "spvector" ) {
		b = fullVector(b);
		tb = "vector";
	}
	if (tb == "spmatrix" ) {
		b = fullMatrix(b);
		tb = "matrix";
	}
	
	if ( ta == "number" && tb == "number" ) 
		return Math.max(a,b);
	else if ( ta == "number") {
		if ( tb == "vector" )  
			return maxVectorScalar(b, a ) ;
		else 
			return maxMatrixScalar(b, a ) ;
	}	
	else if ( tb == "number" ) {
		if ( ta == "vector" ) 
			return maxVectorScalar(a, b);
		else {
			// MAtrix , scalar 
			if ( b == 1) 
				return maxMatrixRows(a); // return row vector of max of columns
			else if ( b == 2 ) 
				return maxMatrixCols(a); // return column vector of max of rows
			else 
				return maxMatrixScalar(a, b);
		}
	}
	else if ( ta == "vector" ) {
		if ( tb == "vector" ) 
			return maxVectorVector(a,b);
		else 
			return "undefined";
	}
	else {
		if ( tb == "matrix" ) 
			return maxMatrixMatrix(a,b);
		else 
			return "undefined";				
	}
}
/**
 * @param {Matrix} 
 */
function transposeMatrix ( A ) {
	var i;
	var j;
	const m = A.m;
	const n = A.n;
	if ( m > 1 ) {
		var res = zeros( n,m);
		var Aj = 0;
		for ( j=0; j< m;j++) {
			var ri = 0;
			for ( i=0; i < n ; i++) {
				res.val[ri + j] = A.val[Aj + i];
				ri += m;
			}
			Aj += n;
		}
		return res;
	}
	else {
		return A.val;
	}
}
/**
 * @param {Float64Array} 
 * @return {Matrix}
 */
function transposeVector ( a ) {
	return new Matrix(1,a.length, a);
}
function transpose( A ) {	
	var i;
	var j;
	switch( type( A ) ) {
		case "number":
			return A;
			break;
		case "vector":
			var res = new Matrix(1,A.length, A);
			return res;	// matrix with a single row
			break;
		case "spvector":
			return transposespVector(A);
			break;
		case "ComplexVector":
			var res = new ComplexMatrix(1,A.length, conj(A));
			return res;	// matrix with a single row
			break;
		case "matrix":	
			return transposeMatrix(A);
			break;
		case "spmatrix":
			return transposespMatrix(A);
			break;
		case "ComplexMatrix":
			return transposeComplexMatrix(A);
			break;
		default:
			return undefined;
			break;
	}
}

/**
 * @param {Matrix} 
 * @return {number}
 */
function det( A ) {	
	const n = A.n;
	if ( A.m != n || typeof(A.m) =="undefined") 
		return undefined; 
	
	if ( n == 2 ) {
		return A.val[0]*A.val[3] - A.val[1]*A.val[2];
	}
	else {
		var detA = 0;
		var i,j;
		for ( i=0; i < n; i++ ) {
			var proddiag = 1;
			for ( j=0; j < n ; j++) 
				proddiag *= A.val[( (i+j)%n ) * n + j];			
			
			detA += proddiag;			
		}
		for ( i=0; i < n; i++ ) {
			var proddiag = 1;
			for ( j=0; j < n ; j++) 
				proddiag *= A.val[( (i+n-1-j)%n ) * n + j];			
			
			detA -= proddiag;			
		}
	}
	return detA;
}
function trace ( A ) {
	if ( type(A) == "matrix") {
		var n = A.length;
		if ( A.m  != n ) 
			return "undefined";
		var res = 0;
		for ( var i =0; i< n;i++) 
			res += A.val[i*n + i];
		return res;
	}
	else {
		return undefined;
	}
}
/**
 * @param {Matrix} 
 * @return {Matrix}
 */
function triu ( A ) {
	// return the upper triangular part of A
	var i;
	var j;
	const n = A.n;
	const m = A.m;
	var res = zeros(m, n);
	var im = m;
	if ( n < m )
		im = n;
	var r = 0;
	for (i=0; i < im; i++) {
		for ( j=i; j < n; j++)
			res.val[r + j] = A.val[r + j]; 
		r += n;
	}
	return res;
}
/**
 * @param {Matrix} 
 * @return {Matrix}
 */
function tril ( A ) {	
	// return the lower triangular part of A
	var i;
	var j;
	const n = A.n;
	const m = A.m;
	var res = zeros(m, n);
	var im = m;
	if ( n < m )
		im = n;
	var r = 0;		
	for (i=0; i < im; i++) {
		for ( j=0; j <= i; j++)
			res.val[r + j] = A.val[r + j]; 
		r += n;
	}
	if ( m > im ) {
		for (i=im; i < m; i++) {
			for ( j=0; j < n; j++)
				res.val[r + j] = A.val[r + j]; 
			r += n;	
		}
	}
	return res;
}

/**
 * @param {Matrix} 
 * @return {boolean}
 */
function issymmetric ( A ) {	
	const m = A.m;
	const n= A.n;
	if ( m != n )
		return false;
		
	for (var i=0;i < m; i++)
		for ( var j=0; j < n; j++) 
			if ( A.val[i*n+j] != A.val[j*n+i] )
				return false;
				
	return true;
}

/** Concatenate matrices/vectors
 * @param {Array} 
 * @param {boolean}
 * @return {Matrix}
 */
function mat( elems, rowwise ) {
	var k;
	var concatWithNumbers = false;
	var elemtypes = new Array(elems.length);
	for ( k=0; k < elems.length; k++) {
		elemtypes[k] = type(elems[k]);
		if ( elemtypes[k] == "number" ) 
			concatWithNumbers = true;		
	}
	
	
	if (typeof(rowwise ) == "undefined") {
		// check if vector of numbers
		if ( type(elems) == "vector" )
			return new Float64Array(elems);
			
		// check if 2D Array => toMatrix rowwise
		var rowwise = true;		
		for (k=0; k < elems.length; k++) {
			if ( !Array.isArray(elems[k] ) || elemtypes[k] == "vector" ) {
				rowwise = false;
				if ( elemtypes[k] == "string" ) 
					return elems; // received vector of strings => return it directly
			}
		}
	}

	if ( elems.length == 0 ) {
		return []; 
	}

	var m = 0;
	var n = 0;
	var i;
	var j;
	if ( rowwise ) {
		var res = new Array( ) ;
		
		for ( k= 0; k<elems.length; k++) {
			switch( elemtypes[k] ) {
			case "matrix":
				res. push( elems[k].val ) ;
				m += elems[k].m;
				n = elems[k].n;
				break;
			
			case "vector": 				
				if ( concatWithNumbers ) {
					// return a column by concatenating vectors and numbers
					for ( var l=0; l < elems[k].length; l++)
						res.push(elems[k][l]) ;
					n = 1;
					m += elems[k].length;
				}
				else {
					// vector (auto transposed) as row in a matrix
					res.push (elems[k]) ;
					m += 1;
					n = elems[k].length;
				}
				break;
			
			case "number":
				res.push(elems[k]) ; 
				m += 1; 
				n = 1;
				break;

			case "spvector":
				return spmat(elems);

			default:
				// Array containing not only numbers... 
				// probably calling mat( Array2D ) => return Array2D
				return elems;
				break;
			}
		}
		if ( n == 1) {
			var M = new Float64Array(res); 
			return M; 
		}
		var M = new Matrix( m , n ) ;
		var p = 0;
		for (k=0; k < res.length ; k++) {
			if(res[k].buffer) {
				M.val.set( res[k], p);
				p += res[k].length;
			}
			else {
				for ( j=0; j < res[k].length; j++)
					M.val[p+j] = res[k][j];
				p += res[k].length;
			}
		}
		return M;
	}
	else {
		// compute size
		m = size(elems[0], 1);
		for ( k= 0; k<elems.length; k++) {
			if ( elemtypes[k] == "matrix")
				n += elems[k].n;
			else 
				n++;
			if ( size( elems[k], 1) != m)
				return "undefined";			
		}

		// Build matrix
		var res = new Matrix(m, n); 
		var c;
		for (i=0;i<m;i++) {
			c = 0; // col index
			for ( k=0;k<elems.length; k++) {
				switch( elemtypes[k] ) {
				case "matrix":
					for ( j=0; j < elems[k].n; j++) {
							res.val[i*n + j+c] = elems[k].val[i*elems[k].n + j] ;
					}
					c += elems[k].n;
					break;
				
				case "vector": //vector 
					res.val[i*n +c]= elems[k][i] ;
					c++;
					break;
				
				case "number":
					res.val[i*n+c] = elems[k]; 
					c++;
					break;
				default:
					break;
				}
			}
		}
		
		return res;
	}
}
/// Relational Operators

function isEqual( a, b) {
	var i;
	var j;
	var res;
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isEqual(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( isZero( a[i] - b ) )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isEqual(a.val, b), true );
				return res;
				break;
			default:
				return (a==b?1:0);
		}
	}
	else if ( ta == tb ) {

		switch( ta ) {
			case "number":
				return ( isZero(a - b)?1:0 );
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( isZero( a[i] - b[i] ) )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isEqual(a.val, b.val) , true);
				return res;
				break;
			default:
				return (a==b?1:0);
		}
	}
	else 
		return "undefined";
}	 
function isNotEqual( a, b) {
	var i;
	var j;
	var res;
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isNotEqual(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( !isZero( a[i] - b ) )
						res[i] = 1;		
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isNotEqual(a.val, b), true );
				return res;
				break;
			default:
				return (a!=b?1:0);
		}
	}
	else if ( ta == tb ) {

		switch( ta ) {
			case "number":
				return ( !isZero(a - b)?1:0 );
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( !isZero( get(a, i) - get(b,i) ) )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isNotEqual(a.val, b.val), true );
				return res;
				break;
			default:
				return (a!=b?1:0);
		}
	}
	else 
		return "undefined";
}	 

function isGreater( a, b) {
	var i;
	var j;
	var res;
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isGreater(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  a[i] - b > EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isGreater(a.val, b), true );
				return res;
				break;
			default:
				return (a>b?1:0);
		}
	}
	else if (ta == tb) {

		switch( ta ) {
			case "number":
				return (a>b?1:0);
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  a[i] - b[i] > EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isGreater(a.val, b.val), true );
				return res;
				break;
			default:
				return (a>b?1:0);
		}
	}
	else 
		return "undefined";
}	 
function isGreaterOrEqual( a, b) {
	var i;
	var j;
	var res;
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isGreaterOrEqual(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  a[i] - b > -EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isGreaterOrEqual(a.val, b), true );
				return res;
				break;
			default:
				return (a>=b?1:0);
		}
	}
	else if ( ta == tb ) {

		switch( ta ) {
			case "number":
				return (a>=b);
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( a[i] - b[i] > -EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isGreaterOrEqual(a.val, b.val), true );
				return res;
				break;
			default:
				return (a>=b?1:0);
		}
	}
	else 
		return "undefined";
}	 

function isLower( a, b) {
	var i;
	var j;
	var res;
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isLower(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  b - a[i] > EPS ) 
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isLower(a.val, b), true );
				return res;
				break;
			default:
				return (a<b?1:0);
		}
	}
	else if ( ta == tb ) {

		switch( ta ) {
			case "number":
				return (a<b?1:0);
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  b[i] - a[i] > EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isLower(a.val, b.val), true );
				return res;
				break;
			default:
				return (a<b?1:0);
		}
	}
	else 
		return "undefined";
}	 
function isLowerOrEqual( a, b) {
	var i;
	var j;
	var res;
	
	var ta = type(a);
	var tb = type(b);
	
	if ( ta == "number" && tb != "number" )
		return isLowerOrEqual(b,a);
	
	if( ta != "number" && tb == "number" ) {
		// vector/matrix + scalar
		switch( ta ) {
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if (  b - a[i] > -EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isLowerOrEqual(a.val, b), true );
				return res;
				break;
			default:
				return (a<=b?1:0);
		}
	}
	else if ( ta == tb ) {

		switch( ta ) {
			case "number":
				return (a<=b?1:0);
				break;
			case "vector":
				res = new Float64Array(a.length);
				for ( i=0; i<a.length; i++) {
					if ( b[i] - a[i] > -EPS )
						res[i] = 1;					
				}
				return res;
				break;
			case "matrix":
				res = new Matrix(a.m, a.n, isLowerOrEqual(a.val, b.val) , true);
				return res;
				break;
			default:
				return (a<=b?1:0);
		}
	}
	else 
		return "undefined";
}	 


function find( b ) {
	// b is a boolean vector of 0 and 1.
	// return the indexes of the 1's.
	var i;
	var n = b.length;
	var res = new Array();
	for ( i=0; i < n; i++) {
		if ( b[i] != 0 )
			res.push(i);			
	}
	return res;
}
argmax = findmax;
function findmax( x ) {
	// return the index of the maximum in x
	var i;
	
	switch ( type(x)) {
	case "number":
		return 0;
		break;
	case "vector":
		var idx = 0;
		var maxi = x[0];
		for ( i= 1; i< x.length; i++) {
			if ( x[i] > maxi ) {
				maxi = x[i];
				idx = i;
			}
		}
		return idx;
		break;	
	case "spvector":
		var maxi = x.val[0];
		var idx = x.ind[0];

		for ( i= 1; i< x.val.length; i++) {
			if ( x.val[i] > maxi ) {
				maxi = x.val[i];
				idx = x.ind[i];
			}
		}
		if ( maxi < 0 && x.val.length < x.length ) {
			idx = 0;
			while ( x.ind.indexOf(idx) >= 0 && idx < x.length)
				idx++;
		}
		return idx;
		break;			
	default:
		return "undefined";
	}	

}
argmin = findmin;
function findmin( x ) {
	// return the index of the minimum in x
	var i;
	
	switch ( type(x)) {
	case "number":
		return 0;
		break;
	case "vector":
		var idx = 0;
		var mini = x[0];
		for ( i= 1; i< x.length; i++) {
			if ( x[i] < mini ) {
				mini = x[i];
				idx = i;
			}
		}		
		return idx;
		break;
	case "spvector":
		var mini = x.val[0];
		var idx = x.ind[0];

		for ( i= 1; i< x.val.length; i++) {
			if ( x.val[i] < mini ) {
				mini = x.val[i];
				idx = x.ind[i];
			}
		}
		if ( mini > 0 && x.val.length < x.length ) {
			idx = 0;
			while ( x.ind.indexOf(idx) >= 0 && idx < x.length)
				idx++;
		}
		return idx;
		break;				
	default:
		return "undefined";
	}

}

/**
 * @param {Float64Array}
 * @param {boolean} 
 * @param {boolean}  
 * @return {Float64Array|Array} 
 */
function sort( x, decreasingOrder , returnIndexes) {
	// if returnIndexes = true : replace x with its sorted version 
	// otherwise return a sorted copy without altering x

	if ( typeof(decreasingOrder) == "undefined")
		var decreasingOrder = false;
	if ( typeof(returnIndexes) == "undefined")
		var returnIndexes = false;
	
	var i;
	var j;
	var tmp;
		
	const n = x.length;
	if ( returnIndexes ) {
		var indexes = range(n);
		for ( i=0; i < n - 1; i++) {
			if ( decreasingOrder ) 
				j = findmax( get ( x, range(i,n) ) ) + i ;
			else 
				j = findmin( get ( x, range(i,n) ) ) + i;		

			if ( i!=j) {
				tmp = x[i]; 
				x[i] = x[j];
				x[j] = tmp;
			
				tmp = indexes[i]; 
				indexes[i] = indexes[j];
				indexes[j] = tmp;
			}			
		}
		return indexes;
	}
	else {
		var xs = vectorCopy(x);
		for ( i=0; i < n - 1; i++) {
			if ( decreasingOrder ) 
				j = findmax( get ( xs, range(i,n) ) ) + i;
			else 
				j = findmin( get ( xs, range(i,n) ) ) + i;		
			
			if ( i!=j) {
				tmp = xs[i]; 
				xs[i] = xs[j];
				xs[j] = tmp;
			}
		}
		return xs;
	}
}

/// Stats
/**
 * @param {Float64Array} 
 * @return {number}
 */
function sumVector ( a ) {
	var i;
	const n = a.length;
	var res = a[0];
	for ( i=1; i< n; i++) 
		res += a[i];
	return res;
}
/**
 * @param {Matrix} 
 * @return {number}
 */
function sumMatrix ( A ) {
	return sumVector(A.val);
}
/**
 * @param {Matrix} 
 * @return {Matrix}
 */
function sumMatrixRows( A ) {
	var i;
	var j;
	const m = A.m;
	const n = A.n;
	var res = new Float64Array(n); 
	var r = 0;
	for ( i=0; i< m; i++) {
		for (j=0; j < n; j++)
			res[j] += A.val[r + j]; 
		r += n;
	}
	return new Matrix(1,n,res, true); // return row vector 
}
/**
 * @param {Matrix} 
 * @return {Float64Array}
 */
function sumMatrixCols( A ) {
	const m = A.m;
	var res = new Float64Array(m);
	var r = 0;
	for ( var i=0; i < m; i++) {
		for (var j=0; j < A.n; j++)
			res[i] += A.val[r + j];
		r += A.n;
	}
	return res;
}
function sum( A , sumalongdimension ) {
	
	switch ( type( A ) ) {
	case "vector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {
			return sumVector(A);
		}
		else {
			return vectorCopy(A);
		}
		break;
	case "spvector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) 
			return sumVector(A.val);		
		else 
			return A.copy();
		break;

	case "matrix":
		if( arguments.length == 1  ) {
			return sumMatrix( A ) ;
		}
		else if ( sumalongdimension == 1 ) {
			return sumMatrixRows( A );	
		}
		else if ( sumalongdimension == 2 ) {
			return sumMatrixCols( A );	
		}
		else 
			return undefined;
		break;
	case "spmatrix":
		if( arguments.length == 1  ) {
			return sumVector( A.val ) ;
		}
		else if ( sumalongdimension == 1 ) {
			return sumspMatrixRows( A );	
		}
		else if ( sumalongdimension == 2 ) {
			return sumspMatrixCols( A );	
		}
		else 
			return undefined;
		break;
	default: 
		return A;
		break;
	}
}
/**
 * @param {Float64Array} 
 * @return {number}
 */
function prodVector ( a ) {
	var i;
	const n = a.length;
	var res = a[0];
	for ( i=1; i< n; i++) 
		res *= a[i];
	return res;
}
/**
 * @param {Matrix} 
 * @return {number}
 */
function prodMatrix ( A ) {
	return prodVector(A.val);
}
/**
 * @param {Matrix} 
 * @return {Matrix}
 */
function prodMatrixRows( A ) {
	var i;
	var j;
	const m = A.m;
	const n = A.n;
	var res = new Float64Array(A.row(0)); 
	var r = n;
	for ( i=1; i< m; i++) {
		for (j=0; j < n; j++)
			res[j] *= A.val[r + j]; 
		r += A.n;
	}
	return new Matrix(1,n,res, true); // return row vector 
}
/**
 * @param {Matrix} 
 * @return {Float64Array}
 */
function prodMatrixCols( A ) {
	const m = A.m;
	var res = new Float64Array(m);
	var r = 0;
	for ( var i=0; i < m; i++) {
		res[i] = A.val[r];
		for (var j=1; j < A.n; j++)
			res[i] *= A.val[r + j];
		r += A.n;
	}
	return res;
}
function prod( A , prodalongdimension ) {
	
	switch ( type( A ) ) {
	case "vector":
		if ( arguments.length == 1 || prodalongdimension == 1 ) 
			return prodVector(A);
		else 
			return vectorCopy(A);
		break;
	case "spvector":
		if ( arguments.length == 1 || prodalongdimension == 1 ) {
			if ( A.val.length < A.length )
				return 0;
			else
				return prodVector(A.val);
		}
		else 
			return A.copy();
		break;
	case "matrix":
		if( arguments.length == 1  ) {
			return prodMatrix( A ) ;
		}
		else if ( prodalongdimension == 1 ) {
			return prodMatrixRows( A );	
		}
		else if ( prodalongdimension == 2 ) {
			return prodMatrixCols( A );	
		}
		else 
			return undefined;
		break;
	case "spmatrix":
		if( arguments.length == 1  ) { 
			if ( A.val.length < A.m * A.n )
				return 0;
			else
				return prodVector( A.val ) ;
		}
		else if ( prodalongdimension == 1 ) {
			return prodspMatrixRows( A );	
		}
		else if ( prodalongdimension == 2 ) {
			return prodspMatrixCols( A );	
		}
		else 
			return undefined;
		break;
	default: 
		return A;
		break;
	}
}

function mean( A , sumalongdimension ) {
	
	switch ( type( A ) ) {
	case "vector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {
			return sumVector(A) / A.length;
		}
		else {
			return vectorCopy(A);
		}
		break;
	case "spvector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) 
			return sumVector(A.val) / A.length;		
		else 
			return A.copy();		
		break;

	case "matrix":
		if( arguments.length == 1  ) {
			return sumMatrix( A ) / ( A.m * A.n);
		}
		else if ( sumalongdimension == 1 ) {
			return mulScalarMatrix( 1/A.m, sumMatrixRows( A ));	
		}
		else if ( sumalongdimension == 2 ) {
			return mulScalarVector( 1/A.n, sumMatrixCols( A )) ;	
		}
		else 
			return undefined;
		break;
	case "spmatrix":
		if( arguments.length == 1  ) {
			return sumVector( A.val ) / ( A.m * A.n);
		}
		else if ( sumalongdimension == 1 ) {
			return mulScalarMatrix(1/A.m, sumspMatrixRows(A));
		}
		else if ( sumalongdimension == 2 ) {
			return mulScalarVector(1/A.n, sumspMatrixCols(A));
		}
		else 
			return undefined;
		break;
	default: 
		return A;
		break;
	}
}

function variance(A, alongdimension ) {
	// variance = sum(A^2)/n - mean(A)^2
	if ( arguments.length > 1 )	
		var meanA = mean(A, alongdimension);
	else
		var meanA = mean(A);

	switch ( type( A ) ) {
	case "number":
		return 0;
		break;
	case "vector":
		if ( arguments.length == 1 || alongdimension == 1 ) {		
			var res = ( dot(A,A) / A.length ) - meanA*meanA;
			return res ;
		}
		else {
			return zeros(A.length);
		}
		break;
	case "spvector":
		if ( arguments.length == 1 || alongdimension == 1 ) {		
			var res = ( dot(A.val,A.val) / A.length ) - meanA*meanA;
			return res ;
		}
		else 
			return zeros(A.length);
		
		break;
			
	case "matrix":
	case "spmatrix":
		if( typeof(alongdimension) == "undefined" ) {
			var res = (sum(entrywisemul(A,A)) / (A.m * A.n ) ) - meanA*meanA;
			return res;
		}
		else if ( alongdimension == 1 ) {
			// var of columns
			var res = sub( entrywisediv(sum(entrywisemul(A,A),1) , A.length ) , entrywisemul(meanA,meanA) );			
			return res;		
		}
		else if ( alongdimension == 2 ) {
			// sum all columns, result is column vector
			res = sub( entrywisediv(sum(entrywisemul(A,A),2) , A.n ) , entrywisemul(meanA,meanA) );
			return res;		
		}
		else 
			return undefined;
		break;
	default: 
		return undefined;
	}
}

function std(A, alongdimension)  {
	if ( arguments.length > 1 )	
		return sqrt(variance(A,alongdimension));
	else
		return sqrt(variance(A));
}

/**
 * Covariance matrix C = X'*X ./ X.m
 * @param {Matrix|Float64Array|spVector}
 * @return {Matrix|number}
 */
function cov( X ) {	
	switch ( type( X ) ) {
	case "number":
		return 0;
		break;
	case "vector":
		var mu = mean(X);
		return ( dot(X,X) / X.length - mu*mu);
		break;		
	case "spvector":
		var mu = mean(X);
		return ( dot(X.val,X.val) / X.length - mu*mu);
		break;
	case "matrix":
		var mu = mean(X,1).row(0);
		return divMatrixScalar(xtx( subMatrices(X, outerprod(ones(X.m), mu ) ) ), X.m);
		break;
	case "spmatrix":
		var mu = mean(X,1).row(0);
		return divMatrixScalar(xtx( subspMatrixMatrix(X, outerprod(ones(X.m), mu ) ) ), X.m);
		break;
	default: 
		return undefined;
	}
}
/**
 * Compute X'*X
 * @param {Matrix}
 * @return {Matrix}
 */
function xtx( X ) {
	const N = X.m;
	const d = X.n; 

	var C = new Matrix(d,d); 
	for (var i=0; i < N; i++) {
		var xi= X.row(i);
		for(var k = 0; k < d; k++) {
			var xik = xi[k];
			for (var j=k; j < d; j++) {
				C.val[k*d + j] += xik * xi[j]; 
			}
		}
	}
	// Symmetric lower triangular part:
	for(var k = 0; k < d; k++) {
		var kd = k*d;
		for (var j=k; j < d; j++) 
			C.val[j*d+k] = C.val[kd+j]; 
	}
	return C;
}

function norm( A , sumalongdimension ) {
	// l2-norm (Euclidean norm) of vectors or Frobenius norm of matrix
	var i;
	var j;
	switch ( type( A ) ) {
	case "number":
		return Math.abs(A);
		break;
	case "vector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {
			return Math.sqrt(dot(A,A));
		}
		else 
			return abs(A);
		break;
	case "spvector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {
			return Math.sqrt(dot(A.val,A.val));
		}
		else 
			return abs(A);
		break;
	case "matrix":
		if( arguments.length == 1 ) {
			return Math.sqrt(dot(A.val,A.val));
		}
		else if ( sumalongdimension == 1 ) {
			// norm of columns, result is row vector
			const n = A.n;
			var res = zeros(1, n);			
			var r = 0;
			for (i=0; i< A.m; i++) {				
				for(j=0; j<n; j++) 
					res.val[j] += A.val[r+j]*A.val[r + j];
				r += n;
			}
			for(j=0;j<n; j++)
				res.val[j] = Math.sqrt(res.val[j]);
			return res;		
		}
		else if ( sumalongdimension == 2 ) {
			// norm of rows, result is column vector
			var res = zeros(A.m);
			var r = 0;
			for ( i=0; i < A.m; i++) {
				for ( j=0; j < A.n; j++)
					res[i] += A.val[r + j] * A.val[r + j];
				r += A.n;
				res[i] = Math.sqrt(res[i]);
			}			
			
			return res;		
		}
		else 
			return "undefined";
		break;
	case "spmatrix":
		if( arguments.length == 1 ) {
			return Math.sqrt(dot(A.val,A.val));
		}
		else if ( sumalongdimension == 1 && !A.rowmajor ) {
			// norm of columns, result is row vector
			const nn = A.n;
			var res = zeros(1, nn);
			for(j=0; j<nn; j++) {
				var s = A.cols[j];
				var e = A.cols[j+1];
				for ( var k=s; k < e; k++)
					res.val[j] += A.val[k]*A.val[k];
				res.val[j] = Math.sqrt(res.val[j]);
			}
			return res;		
		}
		else if ( sumalongdimension == 2 && A.rowmajor ) {
			// norm of rows, result is column vector
			var res = zeros(A.m);
			for ( i=0; i < A.m; i++) {
				var s = A.rows[i];
				var e = A.rows[i+1];
				for ( var k=s; k < e; k++)
					res[i] += A.val[k] * A.val[k];
				res[i] = Math.sqrt(res[i]);
			}
			
			return res;		
		}
		else 
			return "undefined";
		break;
	default: 
		return "undefined";
	}
}
function norm1( A , sumalongdimension ) {
	// l1-norm of vectors and matrices
	if ( arguments.length == 1 )
		return sum(abs(A));
	else
		return sum(abs(A), sumalongdimension);
}
function norminf( A , sumalongdimension ) {
	// linf-norm of vectors and max-norm of matrices
	if ( arguments.length == 1 )
		return max(abs(A));
	else
		return max(abs(A), sumalongdimension);
}
function normp( A , p, sumalongdimension ) {
	// lp-norm of vectors and matrices
	if ( arguments.length == 2 )
		return Math.pow( sum(pow(abs(A), p) ), 1/p);
	else
		return pow(sum(pow(abs(A), p), sumalongdimension), 1/p);
}

function normnuc( A ) {
	// nuclear norm
	switch( type(A) ) {
	case "matrix":
		return sumVector(svd(A)); 
		break;
	case "spmatrix":
		return sumVector(svd(fullMatrix(A))); 
		break;
	case "number":
		return A;
		break;
	case "vector":
	case "spvector":
		return 1;
		break;
	default:
		return undefined;
		break;
	}
}
function norm0( A , sumalongdimension, epsilonarg ) {
	// l0-pseudo-norm of vectors and matrices
	// if epsilon > 0, consider values < epsilon as 0
	
	var epsilon = EPS;
	if ( arguments.length == 3 ) 
		epsilon = epsilonarg;
	
	var i;
	var j;
	switch ( type( A ) ) {
	case "number":
		return (Math.abs(A) > epsilon);
		break;
	case "vector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {		
			return norm0Vector(A, epsilon);
		}
		else 
			return isGreater(abs(a), epsilon);
		break;
	case "spvector":
		if ( arguments.length == 1 || sumalongdimension == 1 ) {		
			return norm0Vector(A.val, epsilon);
		}
		else 
			return isGreater(abs(a), epsilon);
		break;
	case "matrix":
		if( arguments.length == 1 ) {
			return norm0Vector(A.val, epsilon);
		}
		else if ( sumalongdimension == 1 ) {
			// norm of columns, result is row vector
			var res = zeros(1, A.n);
			for (i=0; i< A.m; i++) {				
				for(j = 0; j < A.n; j++) 
					if ( Math.abs(A[i*A.n + j]) > epsilon )
						res.val[j]++;
			}
			return res;		
		}
		else if ( sumalongdimension == 2 ) {
			// norm of rows, result is column vector
			var res = zeros(A.m);
			for (i=0; i< A.m; i++) {
				for(j = 0; j < A.n; j++) 
					if ( Math.abs(A[i*A.n + j]) > epsilon )
						res[i]++;	
			}
			return res;		
		}
		else 
			return undefined;
		break;
	case "spmatrix":
		if( arguments.length == 1 ) {
			return norm0Vector(A.val, epsilon);
		}
		else if ( sumalongdimension == 1 ) {
			// norm of columns, result is row vector
			var res = zeros(1, A.n);
			if ( A.rowmajor ) {
				for ( var k=0; k < A.val.length; k++)
					if (Math.abs(A.val[k]) > epsilon)
						res.val[A.cols[k]] ++;
			}
			else {
				for ( var i=0; i<A.n; i++)
					res.val[i] = norm0Vector(A.col(i).val, epsilon);
			}
			return res;		
		}
		else if ( sumalongdimension == 2 ) {
			// norm of rows, result is column vector
			var res = zeros(A.m);
			if ( A.rowmajor ) {
				for ( var i=0; i<A.m; i++)
					res[i] = norm0Vector(A.row(i).val, epsilon);			
			}
			else {
				for ( var k=0; k < A.val.length; k++)
					if (Math.abs(A.val[k]) > epsilon)
						res[A.rows[k]]++;
			}
			return res;		
		}
		else 
			return undefined;
		break;
	default: 
		return undefined;
	}
}
/**
 * @param {Float64Array}
 * @param {number}
 * @return {number}
 */
function norm0Vector( x, epsilon ) {
	const n = x.length;
	var res = 0;	
	for (var i=0; i < n; i++)
		if ( Math.abs(x[i]) > epsilon )
			res++;
	return res;
}

///////////////////////////////////////////:
// Linear systems of equations
///////////////////////////////////////

function solve( A, b ) {
	/* Solve the linear system Ax = b	*/

	var tA = type(A);

	if ( tA == "vector" || tA == "spvector" || (tA == "matrix" && A.m == 1) ) {
		// One-dimensional least squares problem: 
		var AtA = mul(transpose(A),A);
		var Atb = mul(transpose(A), b);
		return Atb / AtA; 		
	}
	
	if ( tA == "spmatrix" ) {
		/*if ( A.m == A.n )
			return spsolvecg(A, b); // assume A is positive definite
		else*/
		return spcgnr(A, b);
	}

	if( type(b) == "vector" ) {
		if ( A.m == A.n )
			return solveGaussianElimination(A, b) ; 			
		else
			return solveWithQRcolumnpivoting(A, b) ; 
	}
	else
		return solveWithQRcolumnpivotingMultipleRHS(A, b) ; // b is a matrix
}
/**
 * Solve the linear system Ax = b given the Cholesky factor L of A
 * @param {Matrix}
 * @param {Float64Array} 
 * @return {Float64Array}
 */
function cholsolve ( L, b ) {
	var z = forwardsubstitution(L, b);
	var x = backsubstitution(transposeMatrix(L), z);
	return x;
}

/**
 * @param {Matrix}
 * @param {Float64Array} 
 * @return {Float64Array}
 */
function solveWithQRfactorization ( A, b ) {
	const m = A.length;
	const n = A.n;
	var QRfact = qr(A);
	var R = QRfact.R;
	var beta = QRfact.beta;
	
	var btmp = vectorCopy(b);
	var j;
	var i;
	var k;
	var v;
	
	var smallb;
	
	for (j=0;j<n-1; j++) {
		v = get(R, range(j,m), j) ; // get Householder vectors
		v[0] = 1;
		// b(j:m) = (I - beta v v^T ) * b(j:m)
		smallb = get(btmp, range(j,m) );		
		set ( btmp, range(j,m), sub ( smallb , mul( beta[j] * mul( v, smallb) , v ) ) );
	}
	// last iteration only if m>n
	if ( m > n ) {
		j = n-1;
		
		v = get(R, range(j,m), j) ; // get Householder vectors
		v[0] = 1;
		// b(j:m) = (I - beta v v^T ) * b(j:m)
		smallb = get(btmp, range(j,m) );		
		set ( btmp, range(j,m), sub ( smallb , mul( beta[j] * mul( v, smallb) , v ) ) );

	}
	
	// Solve R x = b with backsubstitution (R is upper triangular, well it is not really here because we use the lower part to store the vectors v): 
	return backsubstitution ( R , get ( btmp, range(n)) );
	
	
//	return backsubstitution ( get ( R, range(n), range(n) ) , rows ( btmp, range(1,n)) );
//	we can spare the get and copy of R : backsubstitution will only use this part anyway
}

/**
 * @param {Matrix}
 * @param {Float64Array} 
 * @return {Float64Array}
 */
function backsubstitution ( U, b ) {
	// backsubstitution to solve a linear system U x = b with upper triangular U

	const n = b.length;
	var j = n-1;
	var x = zeros(n);
	
	if ( ! isZero(U.val[j*n+j]) )
		x[j] = b[j] / U.val[j*n+j];
	
	j = n-2;
	if ( !isZero(U.val[j*n+j]) )
		x[j] = ( b[j] - U.val[j*n+n-1] * x[n-1] ) / U.val[j*n+j];
		
	for ( j=n-3; j >= 0 ; j-- ) {
		if ( ! isZero(U.val[j*n+j]) )
			x[j] = ( b[j] - dot( U.row(j).subarray(j+1,n) , x.subarray(j+1,n) ) ) / U.val[j*n+j];		
	}
	
	// solution
	return x;
}
/**
 * @param {Matrix}
 * @param {Float64Array} 
 * @return {Float64Array}
 */
function forwardsubstitution ( L, b ) {
	// forward substitution to solve a linear system L x = b with lower triangular L

	const n = b.length;
	var j;
	var x = zeros(n);
		
	if ( !isZero(L.val[0]) )
		x[0] = b[0] / L.val[0];
	
	if ( ! isZero(L.val[n+1]) )
		x[1] = ( b[1] - L.val[n] * x[0] ) / L.val[n+1];
		
	for ( j=2; j < n ; j++ ) {
		if ( ! isZero(L.val[j*n+j]) )
			x[j] = ( b[j] - dot( L.row(j).subarray(0,j) , x.subarray(0,j) ) ) / L.val[j*n+j];		
	}
	
	// solution
	return x;
}
/**
 * @param {Matrix}
 * @param {Float64Array} 
 * @return {Float64Array}
 */
function solveWithQRcolumnpivoting ( A, b ) {
	
	var m;
	var n;
	var R;
	var V;
	var beta;
	var r;
	var piv;
	if ( type( A ) == "matrix" ) {
		// Compute the QR factorization
		m = A.m;
		n = A.n;
		var QRfact = qr(A);
		R = QRfact.R;
		V = QRfact.V;
		beta = QRfact.beta;
		r = QRfact.rank;
		piv = QRfact.piv;
	}
	else {
		// we get the QR factorization in A
		R = A.R;
		r = A.rank;
		V = A.V;
		beta = A.beta;
		piv = A.piv;
		m = R.m;
		n = R.n;
	}

	var btmp = vectorCopy(b);
	var j;
	var i;
	var k;

	var smallb;
	// b = Q' * b
	for (j=0;j < r; j++) {
	
		// b(j:m) = (I - beta v v^T ) * b(j:m)
		smallb = get(btmp, range(j,m) );		
		
		set ( btmp, range(j,m), sub ( smallb , mul( beta[j] * mul( V[j], smallb) , V[j] ) ) );
	}
	// Solve R x = b with backsubstitution
	var x = zeros(n);

	if ( r > 1 ) {
		set ( x, range(0,r), backsubstitution ( R , get ( btmp, range(r)) ) );
		// note: if m < n, backsubstitution only uses n columns of R.
	}
	else {
		x[0] = btmp[0] / R.val[0];
	}
	
	// and apply permutations
	for ( j=r-1; j>=0; j--) {
		if ( piv[j] != j ) {
			var tmp = x[j] ;
			x[j] = x[piv[j]];
			x[piv[j]] = tmp;
		}
	}
	return x;	
	
}
/**
 * @param {Matrix}
 * @param {Matrix} 
 * @return {Matrix}
 */
function solveWithQRcolumnpivotingMultipleRHS ( A, B ) {
	
	var m;
	var n;
	var R;
	var V;
	var beta;
	var r;
	var piv;
	if ( type( A ) == "matrix" ) {
		// Compute the QR factorization
		m = A.m;
		n = A.n;
		var QRfact = qr(A);
		R = QRfact.R;
		V = QRfact.V;
		beta = QRfact.beta;
		r = QRfact.rank;
		piv = QRfact.piv;
	}
	else {
		// we get the QR factorization in A
		R = A.R;
		r = A.rank;
		V = A.V;
		beta = A.beta;
		piv = A.piv;
		m = R.m;
		n = R.n;
	}

	var btmp = matrixCopy(B);
	var j;
	var i;
	var k;

	var smallb;
	// B = Q' * B
	for (j=0;j < r; j++) {
	
		// b(j:m) = (I - beta v v^T ) * b(j:m)
		smallb = get(btmp, range(j,m), [] );
		
		set ( btmp, range(j,m), [], sub ( smallb , mul(mul( beta[j], V[j]), mul( transpose(V[j]), smallb) ) ) );
	}
	// Solve R X = B with backsubstitution
	var X = zeros(n,m);

	if ( r > 1 ) {
		for ( j=0; j < m; j++) 
			set ( X, range(0,r), j, backsubstitution ( R , get ( btmp, range(r), j) ) );
		// note: if m < n, backsubstitution only uses n columns of R.
	}
	else {
		set(X, 0, [], entrywisediv(get(btmp, 0, []) , R.val[0]) );
	}
	
	// and apply permutations
	for ( j=r-1; j>=0; j--) {
		if ( piv[j] != j ) {
			swaprows(X, j, piv[j]);
		}
	}
	return X;	
	
}

function solveGaussianElimination(Aorig, borig) {

	// Solve square linear system Ax = b with Gaussian elimination
	
	var i;
	var j;
	var k;
	
	var A = matrixCopy( Aorig ).toArrayOfFloat64Array(); // useful to quickly switch rows
	var b = vectorCopy( borig ); 
		
	const m = Aorig.m;
	const n = Aorig.n;
	if ( m != n)
		return undefined;
	
	// Set to zero small values... ??
	
	for (k=0; k < m ; k++) {
		
		// Find imax = argmax_i=k...m |A_i,k|
		var imax = k;
		var Aimaxk = Math.abs(A[imax][k]);
		for (i=k+1; i<m ; i++) {
			var Aik = Math.abs( A[i][k] );
			if ( Aik > Aimaxk ) {
				imax = i;
				Aimaxk = Aik;
			}
		}
		if ( isZero( Aimaxk ) ) {
			console.log("** Warning in solve(A,b), A is square but singular, switching from Gaussian elimination to QR method.");
			return solveWithQRcolumnpivoting(Aorig, borig);
		} 
		
		if ( imax != k ) {
			// Permute the rows
			var a = A[k];
			A[k] = A[imax];
			A[imax] = a;
			var tmpb = b[k];
			b[k] = b[imax];
			b[imax] = tmpb;			
		}		
		var Ak = A[k];
		
		// Normalize row k 
		var Akk = Ak[k];
		b[k] /= Akk;
		
		//Ak[k] = 1; // not used afterwards
		for ( j=k+1; j < n; j++) 
			Ak[j] /= Akk;
		
		if ( Math.abs(Akk) < 1e-8 ) {
			console.log("** Warning in solveGaussianElimination: " + Akk + " " + k + ":" + m );
		}
			
		// Substract the kth row from others to get 0s in kth column
		var Aik ;			
		var bk = b[k];
		for ( i=0; i< m; i++) {
			if ( i != k ) {
				var Ai = A[i]; 
				Aik = Ai[k];
				for ( j=k+1; j < n; j++) { // Aij = 0  with j < k and Aik = 0 after this operation but is never used
					Ai[j] -= Aik * Ak[j]; 						
				}
				b[i] -= Aik * bk;				
			}
		}	
	}

	// Solution: 
	return b;
}

function inv( M ) {
	if ( typeof(M) == "number" )
		return 1/M;

	// inverse matrix with Gaussian elimination
		
	var i;
	var j;
	var k;
	const m = M.length;
	const n = M.n;
	if ( m != n)
		return "undefined";
		
	// Make extended linear system:	
	var A = matrixCopy(M) ;
	var B = eye(n); 
		
	for (k=0; k < m ; k++) {
		var kn = k*n;
		
		// Find imax = argmax_i=k...m |A_i,k|
		var imax = k;
		var Aimaxk = Math.abs(A.val[imax*n + k]);
		for (i=k+1; i<m ; i++) {
			if ( Math.abs( A.val[i*n + k] ) > Aimaxk ) {
				imax = i;
				Aimaxk = Math.abs(A.val[i * n + k]);
			}
		}
		if ( Math.abs( Aimaxk ) < 1e-12 ) {
			return "singular";
		} 
		
		if ( imax != k ) {
			// Permute the rows
			swaprows(A, k, imax);
			swaprows(B,k, imax);		
		}		
		
		// Normalize row k 
		var Akk = A.val[kn + k];
		for ( j=0; j < n; j++) {
			A.val[kn + j] /= Akk;
			B.val[kn + j] /= Akk;
		}
		
		if ( Math.abs(Akk) < 1e-8 )
			console.log("!! Warning in inv(): " + Akk + " " + k + ":" + m );
			
		// Substract the kth row from others to get 0s in kth column
		var Aik ;
		for ( i=0; i< m; i++) {
			if ( i != k ) {
				var ri = i*n;
				Aik = A.val[ri+k];
				if ( ! isZero(Aik) ) {
					for ( j=0; j < n; j++) {
						A.val[ri + j] -= Aik * A.val[kn+j]; 
						B.val[ri + j] -= Aik * B.val[kn+j] ;
					}
				}
			}
		}		
	}

	// Solution: 
	return B;
}

function chol( A ) {
	// Compute the Cholesky factorization A = L L^T with L lower triangular 
	// for a positive definite and symmetric A
	// returns L or undefined if A is not positive definite
	const n = A.m;
	if ( A.n != n) {
		error("Cannot compute the cholesky factorization: the matrix is not square.");
		return undefined; 
	}
	const n2= n*n;
	const Aval = A.val;
	var L = new Float64Array(n2);
		
	var i,j;
	// first column = A(:,0) / sqrt(L(0,0)
	var sqrtLjj = Math.sqrt(Aval[0]);
	for ( i=0; i < n2 ; i+=n) { 	// i = i*n = ptr to row i
		L[i] = Aval[i] / sqrtLjj;
	}
	// other colums 
	j = 1;
	var jn = n;
	while ( j < n && !isNaN(sqrtLjj)) {				
		for ( i = jn; i < n2; i+=n ) {	// i = i*n
			var Lij = Aval[i+j];
			for ( var k=0; k < j; k++) {
				Lij -= L[jn + k] * L[i + k]; 
			}
			if (i == jn)
				sqrtLjj = Math.sqrt(Lij);
				
			L[i +j] = Lij / sqrtLjj;
		}
		j++;
		jn += n;
	}
	if ( isNaN(sqrtLjj) ) 
		return undefined; // not positive definite
	else
		return new Matrix(n,n,L,true);
}

function ldlsymmetricpivoting ( Aorig ) {
	// LDL factorization for symmetric matrices
	var A = matrixCopy( Aorig );
	var n = A.length;
	if ( A.m != n ) {
		error("Error in ldl(): the matrix is not square.");
		return undefined;
	}
	var k;
	var piv = zeros(n);
	var alpha;
	var v;
	
	for ( k=0; k < n-1; k++) {
		
		piv[k] = findmax(get(diag(A ), range(k,n) ));
		swaprows(A, k, piv[k] );
		swapcols(A, k, piv[k] );
		alpha = A.val[k*n + k];
		v = getCols ( A, [k]).subarray(k+1,n);
		
		for ( var i=k+1;i < n; i++)
			A.val[i*n + k] /= alpha;
		
		set( A, range(k+1,n),range(k+1,n), sub (get(A,range(k+1,n), range(k+1,n)), outerprod(v,v, 1/alpha)));		
		
	}
	
	// Make it lower triangular
	for (var j=0; j < n-1; j++) {
		for (var k=j+1; k < n ; k++)
			A.val[j*n + k] = 0;
	}
	return {L: A, piv: piv};
}
/**
 * @param {Float64Array} 
 * @return {{v: Float64Array, beta: number}}
 */
function house ( x ) {
	// Compute Houselholder vector v such that 
	// P = (I - beta v v') is orthogonal and Px = ||x|| e_1

	const n = x.length; 
	var i;
	var mu;
	var beta;
	var v = zeros(n);	
	var v0;
	var sigma ;
	
	var x0 = x[0];
	var xx = dot(x,x);
	
	// sigma = x(2:n)^T x(2:n) 
	sigma = xx -x0*x0;	
		
	if ( isZero( sigma ) ) {
		// x(2:n) is zero =>  v=[1,0...0], beta = 0
		beta = 0;
		v[0] = 1;
	}
	else {
		mu = Math.sqrt(xx); // norm(x) ; //Math.sqrt( x0*x0 + sigma );
		if ( x0 < EPS ) {
			v0 = x0 - mu;
		}
		else {
			v0 = -sigma / (x0 + mu);
		}
		
		beta = 2 * v0 * v0 / (sigma + v0 * v0 );
		
		// v = [v0,x(2:n)] / v0
		v[0] = 1;
		for ( i=1; i< n; i++) 
			v[i] = x[i] / v0;		
	}
	
	return { "v" : v , "beta" : beta};
}
/**
 * @param {Matrix}
 * @return {{Q: (Matrix|undefined), R: Matrix, beta: Float64Array}
 */
function qroriginal( A, compute_Q ) {
	// QR factorization based on Householder reflections WITHOUT column pivoting
	// A with m rows and n cols; m >= n
	
	// test with A = [[12,-51,4],[6,167,-68],[-4,24,-41]]
	// then R = [ [14 -21 -14 ], [ -3, 175, -70], [2, -0.75, 35]]
	
	var m = A.length;
	var n = A.n;
	if ( n > m)
		return "QR factorization unavailable for n > m.";
	
	var i;
	var j;
	var k;
	var householder;
	var R = matrixCopy(A);
	var beta = zeros(n); 
	var outer;
	var smallR; 
	var Q;
	var V = new Array(); // store householder vectors

	
	for ( j=0; j < n - 1 ; j++) {
		householder = house( get( R, range(j,m), j) );
		// R(j:m,j:n) = ( I - beta v v' ) * R(j:m,j:n) = R - (beta v) (v'R)
		smallR =  get(R, range(j,m), range(j,n) );
		set ( R, range(j,m), range(j,n) , subMatrices (  smallR , outerprodVectors( householder.v, mulMatrixVector( transposeMatrix(smallR), householder.v) ,  householder.beta ) ) ) ;

		 V[j] = householder.v;
		 beta[j] = householder.beta;
	
	}
	// Last iteration only if m > n: if m=n, (I - beta v v' ) = 1 => R(n,n) is unchanged		
	if ( m > n ) {
		j = n-1;
		smallR = get( R, range(j,m), j) 
		householder = house( smallR );
		 // R(j:m,n) = ( I - beta v v' ) * R(j:m, n) = R(j:m,n) - (beta v) (v'R(j:m,n) ) = Rn - ( beta *(v' * Rn) )* v
		set ( R, range(j,m), n-1 , subVectors (  smallR , mulScalarVector( dot( householder.v, smallR ) *  householder.beta, householder.v  ) ) ) ;

	 	V[j] = vectorCopy(householder.v);
		beta[j] = householder.beta;

	}

	if ( compute_Q ) {
		var r;
		if ( typeof( compute_Q ) == "number") {
			// compute only first r columns of Q
			r = compute_Q; 
			Q = eye(m,r);			
		}
		else {
			Q = eye(m);
			r = m;
		}	
		var smallQ;
		var nmax = n-1;
		if ( m<=n)
			nmax = n-2;
		if ( nmax >= r )
			nmax = r-1;			

		for ( j=nmax; j >=0; j--) {
			smallQ =  get(Q, range(j,m), range(j,r) ); 
			
			if ( r > 1 ) {
				if ( j == r-1) 
					set ( Q, range(j,m), [j] , subVectors (  smallQ ,  mulScalarVector( dot( smallQ, V[j]) * beta[j],  V[j] ) ) );
				else
					set ( Q, range(j,m), range(j,r), sub (  smallQ , outerprod( V[j], mul( transpose( smallQ), V[j]), beta[j] ) ) );
			}
			else
				Q = subVectors (  smallQ , mulScalarVector( dot( smallQ, V[j]) * beta[j],  V[j] ) );
		}		 
	}

	return {"Q" : Q, "R" : R, "beta" : beta };
}	

/**
 * @param {Matrix}
 * @return {{Q: (Matrix|undefined), R: Matrix, V: Array, beta: Float64Array, piv: Float64Array, rank: number}
 */
function qr( A, compute_Q ) {	
	// QR factorization with column pivoting AP = QR based on Householder reflections
	// A with m rows and n cols; m >= n (well, it also works with m < n)
	// piv = vector of permutations : P = P_rank with P_j = identity with swaprows ( j, piv(j) )
	
	// Implemented with R transposed for faster computations on rows instead of columns
	
	/* TEST
	A  = [[12,-51,4],[6,167,-68],[-4,24,-41]]
	QR = qr(A)
	QR.R
	
	
	*/
	const m = A.m;
	const n = A.n;
	
	/*
	if ( n > m)
		return "QR factorization unavailable for n > m.";
	*/
	
	var i;
	var j;

	var householder;
	var R = transpose(A);// transposed for faster implementation
	var Q;
	
	var V = new Array(); // store householder vectors in this list (not a matrix)
	var beta = zeros(n); 
	var piv = zeros(n);
	
	var smallR; 
	
	var r = -1; // rank estimate -1
	
	var normA = norm(A);
	var normR22 = normA;
	var Rij;
	
	const TOL = 1e-5;
	var TOLnormR22square = TOL * normA;
	TOLnormR22square *= TOLnormR22square;
	
	var tau = 0;
	var k = 0;
	var c = zeros (n);
	for ( j=0; j < n ; j++) {
		var Rj = R.val.subarray(j*R.n,j*R.n + R.n);
		c[j] = dot(Rj,Rj);
		if ( c[j] > tau ) {
			tau = c[j];
			k = j;
		}
	}

	var updateR = function (r, v, beta) {
		// set ( R, range(r,n), range(r,m) , subMatrices (  smallR , outerprodVectors( mulMatrixVector( smallR, householder.v), householder.v,  householder.beta ) ) ) ;
		// most of the time is spent here... 
		var i,j,l;
		var m_r = m-r;
		for ( i=r; i < n; i++) {
			var smallRiv = 0;
			var Ri = i*m + r; // =  i * R.n + r
			var Rval = R.val.subarray(Ri,Ri+m_r);
			for ( l = 0 ; l < m_r ; l ++) 
				smallRiv += Rval[l] * v[l];	//smallRiv += R.val[Ri + l] * v[l];
			smallRiv *= beta ;
			for ( j=0; j < m_r ; j ++) {
				Rval[j] -= smallRiv * v[j]; // R.val[Ri + j] -= smallRiv * v[j];
			}
		}
	};

	// Update c
	var updateC = function(r) {
		var j;
		for (j=r+1; j < n; j++) {
			var Rjr = R.val[j*m + r];
			c[j] -= Rjr * Rjr;
		}			

		// tau, k = max ( c[r+1 : n] )
		k=r+1;
		tau = c[r+1];
		for ( j=r+2; j<n;j++) {
			if ( c[j] > tau ) {
				tau = c[j];
				k = j;
			}
		}
	};
	
	// Compute norm of residuals
	var computeNormR22 = function(r) {
		//normR22 = norm(get ( R, range(r+1,n), range(r+1,m), ) );
		var normR22 = 0;
		var i = r+1;
		var ri = i*m;
		var j;
		while ( i < n && normR22 <= TOLnormR22square ) {
			for ( j=r+1; j < m; j++) {
				var Rij = R.val[ri + j];
				normR22 += Rij*Rij;
			}
			i++;
			ri += m;
		}
		return normR22;
	}


	while ( tau > EPS  && r < n-1 &&  normR22 > TOLnormR22square ) {

		r++;
						
		piv[r] = k;
		swaprows ( R, r, k);
		c[k] = c[r];
		c[r] = tau;		

		if ( r < m-1) {
			householder = house( R.val.subarray(r*R.n + r,r*R.n + m) ); // house only reads vec so subarray is ok
		}
		else {
			householder.v = [1];
			householder.beta = 0;
			//smallR = R[m-1][m-1];
		}
		
		if (r < n-1) {
			// smallR is a matrix
			updateR(r, householder.v, householder.beta);
		}
		else {
			// smallR is a row vector (or a number if m=n):	
			if ( r < m-1) {
				updateR(r, householder.v, householder.beta);
			/*
				var r_to_m = range(r,m);
				smallR = get(R, r, r_to_m);
				set ( R, r , r_to_m, sub (  smallR , transpose(mul( householder.beta * mul( smallR, householder.v) ,householder.v  ) )) ) ;*/
			}
			else {
				//var smallRnumber = R.val[(m-1)*R.n + m-1]; // beta is zero, so no update
				//set ( R, r , r, sub (  smallRnumber , transpose(mul( householder.beta * mul( smallRnumber, householder.v) ,householder.v  ) )) ) ;
			}
		}

		// Store householder vectors and beta 			
		V[r] = vectorCopy( householder.v );
		beta[r] = householder.beta;

		if ( r<n-1 ) {
			// Update c
			updateC(r);			

			// stopping criterion for rank estimation
			if ( r < m-1 ) 
				normR22 = computeNormR22(r);
			else
				normR22 = 0;
		}	
	}

	if ( compute_Q ) {
		Q = eye(m);
		var smallQ;
		var nmax = r;
		if ( m > r+1)
			nmax = r-1;
		for ( j=nmax; j >=0; j--) {
			if ( j == m-1 ) {
				Q.val[j*m+j] -=  beta[j] * V[j][0] * V[j][0] * Q.val[j*m+j];
			}
			else {
				var j_to_m = range(j,m);
				smallQ =  get(Q, j_to_m, j_to_m );// matrix
				set ( Q, j_to_m, j_to_m, subMatrices (  smallQ , outerprodVectors(  V[j], mulMatrixVector( transposeMatrix(smallQ), V[j]), beta[j] ) ) );
			}
		}
	}

	return {"Q" : Q, "R" : transpose(R), "V": V, "beta" : beta, "piv" : piv, "rank" : r+1 };
}

function qrRnotTransposed( A, compute_Q ) {
	// QR factorization with column pivoting AP = QR based on Householder reflections
	// A with m rows and n cols; m >= n (well, it also works with m < n)
	// piv = vector of permutations : P = P_rank with P_j = identity with swaprows ( j, piv(j) )
	
	// original implementation working on columns 
	
	/* TEST
	A  = [[12,-51,4],[6,167,-68],[-4,24,-41]]
	QR = qr(A)
	QR.R
	
	
	*/
	var m = A.m;
	var n = A.n;
	
	/*
	if ( n > m)
		return "QR factorization unavailable for n > m.";
	*/
	
	var i;
	var j;

	var householder;
	var R = matrixCopy(A);
	var Q;
	
	var V = new Array(); // store householder vectors in this list (not a matrix)
	var beta = zeros(n); 
	var piv = zeros(n);
	
	var smallR; 
	
	var r = -1; // rank estimate -1
	
	var normA = norm(A);
	var normR22 = normA;
	
	var TOL = 1e-6;
	
	var tau = 0;
	var k = 0;
	var c = zeros (n);
	for ( j=0; j < n ; j++) {
		var Aj = getCols ( A, [j]);
		c[j] = dot(Aj, Aj);
		if ( c[j] > tau ) {
			tau = c[j];
			k = j;
		}
	}

	while ( tau > EPS  && r < n-1 &&  normR22 > TOL * normA ) {
	
		r++;
						
		piv[r] = k;
		swapcols ( R, r, k);
		c[k] = c[r];
		c[r] = tau;		

		if ( r < m-1) {
			householder = house( get( R, range(r,m), r) );
			smallR = get(R, range(r,m), range(r,n) );
		}
		else {
			householder.v = [1];
			householder.beta = 0;
			smallR = R[m-1][m-1];
		}
		
		if (r < n-1) {
			// smallR is a matrix
			set ( R, range(r,m), range(r,n) , subMatrices (  smallR , outerprodVectors( householder.v, mulMatrixVector( transposeMatrix(smallR), householder.v) ,  householder.beta ) ) ) ;
		}
		else {
			// smallR is a vector (or a number if m=n):
			set ( R, range(r,m), r , sub (  smallR , mul( householder.beta * mul( smallR, householder.v) ,householder.v  ) ) ) ;
		}

		// Store householder vectors and beta 			
		if ( m > r+1 )
			V[r] = vectorCopy( householder.v );
		beta[r] = householder.beta;

		if ( r<n-1 ) {
			// Update c
			for ( j=r+1; j < n; j++) {
				c[j] -= R[r][j] * R[r][j];
			}			
	
			// tau, k = max ( c[r+1 : n] )
			k=r+1;
			tau = c[r+1];
			for ( j=r+2; j<n;j++) {
				if ( c[j] > tau ) {
					tau = c[j];
					k = j;
				}
			}

			// stopping criterion for rank estimation
			if ( r < m-1 ) {
				//normR22 = norm(get ( R, range(r+1,m),range(r+1,n) ) );
				normR22 = 0;
				for ( i=r+1; i < m; i++) {
					for ( j=r+1; j < n; j++) {
						Rij = R[i][j];
						normR22 += Rij*Rij;
					}
				}
				normR22 = Math.sqrt(normR22);
			}
			else
				normR22 = 0;
		}
	}
	
	if ( compute_Q ) {
		Q = eye(m);
		var smallQ;
		var nmax = r;
		if ( m>r+1)
			nmax = r-1;
		for ( j=nmax; j >=0; j--) {
			if ( j == m-1 ) {
				Q.val[j*m+j] -=  beta[j] * V[j][0] * V[j][0] * Q.val[j*m+j];
			}
			else {
				smallQ =  get(Q, range(j,m), range(j,m) );
				set ( Q, range(j,m), range(j,m) , subMatrices (  smallQ , outerprodVectors(  V[j], mulMatrixVector( transposeMatrix(smallQ), V[j]), beta[j] ) ) );
			}
		}
		 
	}

	return {"Q" : Q, "R" : R, "V": V, "beta" : beta, "piv" : piv, "rank" : r+1 };
}

/** Conjugate gradient method for solving the symmetyric positive definite system Ax = b
 * @param{{Matrix|spMatrix}}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function solvecg ( A, b) {
	if( A.type == "spmatrix" ) 
		return spsolvecg(A,b);
	else
		return solvecgdense(A,b);		
}

/** Conjugate gradient method for solving the symmetyric positive definite system Ax = b
 * @param{Matrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function solvecgdense ( A, b) {
/*
TEST
A = randn(2000,1000)
x = randn(1000)
b = A*x + 0.01*randn(2000)
tic()
xx = solve(A,b)
t1 = toc()
ee = norm(A*xx - b)
tic()
xh=solvecg(A'*A, A'*b)
t2 = toc()
e = norm(A*xh - b)
*/
	
	const n = A.n;	
	const m = A.m;

	var x = randn(n); //vectorCopy(x0);
	var r = subVectors(b, mulMatrixVector(A, x));
	var rhoc = dot(r,r);
	const TOL = 1e-8;
	var delta2 = TOL * norm(b);
	delta2 *= delta2;
	
	// first iteration:
	var p = vectorCopy(r);
	var w = mulMatrixVector(A,p);
	var mu = rhoc / dot(p, w);
	saxpy( mu, p, x);
	saxpy( -mu, w, r);
	var rho_ = rhoc;
	rhoc = dot(r,r);

	var k = 1;

	var updateP = function (tau, r) {
		for ( var i=0; i < m; i++)
			p[i] = r[i] + tau * p[i];
	}
	
	while ( rhoc > delta2 && k < n ) {
		updateP(rhoc/rho_, r);
		w = mulMatrixVector(A,p);
		mu = rhoc / dot(p, w);
		saxpy( mu, p, x);
		saxpy( -mu, w, r);
		rho_ = rhoc;
		rhoc = dot(r,r);
		k++;
	}
	return x;
}
/** Conjugate gradient normal equation residual method for solving the rectangular system Ax = b
 * @param{{Matrix|spMatrix}}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function cgnr ( A, b) {
	if( A.type == "spmatrix" ) 
		return spcgnr(A,b);
	else
		return cgnrdense(A,b);		
}
/** Conjugate gradient normal equation residual method for solving the rectangular system Ax = b
 * @param{Matrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function cgnrdense ( A, b) {
/*
TEST
A = randn(2000,1000)
x = randn(1000)
b = A*x + 0.01*randn(2000)
tic()
xx = solve(A,b)
t1 = toc()
ee = norm(A*xx - b)
tic()
xh=cgnr(A, b)
t2 = toc()
e = norm(A*xh - b)
*/
	
	const n = A.n;	
	const m = A.m;

	var x = randn(n); // vectorCopy(x0);
	var At = transposeMatrix(A);
	var r = subVectors(b, mulMatrixVector(A, x));	
	const TOL = 1e-8;
	var delta2 = TOL * norm(b);
	delta2 *= delta2;
	
	// first iteration:
	var z = mulMatrixVector(At, r);
	var rhoc = dot(z,z);	
	var p = vectorCopy(z);
	var w = mulMatrixVector(A,p);
	var mu = rhoc / dot(w, w);
	saxpy( mu, p, x);
	saxpy( -mu, w, r);	
	z = mulMatrixVector(At, r);
	var rho_ = rhoc;
	rhoc = dot(z,z);

	var k = 1;

	var updateP = function (tau, z) {
		for ( var i=0; i < m; i++)
			p[i] = z[i] + tau * p[i];
	}
	
	while ( rhoc > delta2 && k < n ) {
		updateP(rhoc/rho_, z);
		w = mulMatrixVector(A,p);
		mu = rhoc / dot(w, w);
		saxpy( mu, p, x);
		saxpy( -mu, w, r);
		z = mulMatrixVector(At, r);
		rho_ = rhoc;
		rhoc = dot(z,z);
		k++;
	}
	return x;
}

/** Lanczos algorithm
 * @param{Matrix}
 */
function lanczos ( A, q1 ) {

	const maxIters = 300;
	const TOL = EPS * norm(A); 
	const n = A.n;
	var i;
	var k = 0;
	var w = vectorCopy(q1);
	var v = mulMatrixVector(A, w);
	var alpha = dot(w,v);
	saxpy(-alpha, w, v);
	beta = norm(b);
	
	while ( beta > TOL && k < maxIters ) {
	
		for ( i=0; i < n; i++) {
			var t = w[i];
			w[i] = v[i] / beta;
			v[i] = -beta / t;
		}
		
		var Aw = mulMatrixVector(A,w);
		
		for ( i=0; i < n; i++) 
			v[i] += Aw[i];
		
		alpha = dot(w,v);
		saxpy(-alpha,w,v);
		beta = norm(v);
		k++;
	}
}

/**
 * @param{Matrix}
 * @param{boolean}
 * @return{Matrix}
 */
function tridiagonalize( A, returnQ ) {
	// A : a square and symmetric  matrix
	// T = Q A Q' , where T is tridiagonal and Q = (H1 ... Hn-2)' is the product of Householder transformations.
	// if returnQ, then T overwrites A
	var k;
	const n = A.length;
	var T;
	var Q;
	var Pk;
	if ( returnQ ) {
		T = A;
		Q = eye(n);
		var beta = [];
		var V = [];
	}
	else
		T = matrixCopy(A);
	var p;
	var w;
	var vwT; 
	var normTkp1k;
	var householder;
	
	for (k=0; k < n-2; k++) {
		Tkp1k = get ( T, range(k+1, n), k);
		Tkp1kp1 = get ( T, range(k+1,n), range(k+1, n));

		householder = house ( Tkp1k );
		p = mulScalarVector( householder.beta , mulMatrixVector( Tkp1kp1, householder.v ) );
		w = subVectors ( p, mulScalarVector( 0.5*householder.beta * dot(p, householder.v ), householder.v) );
		
		/*
		T[k+1][k] = norm ( Tkp1k );
		T[k][k+1] = T[k+1][k];		
		*/
		// make T really tridiagonal: the above does not modify the other entries to set them to 0
		normTkp1k = zeros(n-k-1);
		normTkp1k[0] = norm ( Tkp1k );
		set ( T, k, range(k+1,n ), normTkp1k );		
		set ( T, range(k+1,n), k, normTkp1k);

		vwT = outerprodVectors(householder.v,w);
		set ( T, range(k+1,n), range(k+1, n), subMatrices( subMatrices ( Tkp1kp1, vwT) , transpose(vwT)) );

		if ( returnQ ) {
			V[k] = householder.v;
			beta[k] = householder.beta;
		}
	}
	if ( returnQ ) {
		var updateQ = function(j, v, b) {
			// Q = Q - b* v (Q'v)'
			//smallQ =  get(Q, range(j,n), range(j,n) );// matrix
			//set ( Q, range(j,n), range(j,n) , subMatrices (  smallQ , outerprodVectors(  V[k], mulMatrixVector( transposeMatrix(smallQ), V[k]), beta[k] ) ) );			
			var i,k;
			var Qtv = zeros(n-j);
			var n_j = n-j;
			for ( i=0; i<n_j; i++) {
				var Qi = (i+j)*n + j;
				for ( k=0;k<n_j; k++) 
					Qtv[k] += v[i] * Q.val[Qi + k];
			}
			for ( i=0; i < n_j; i++) {
				var Qi = (i+j)*n + j;
				var betavk = b * v[i];				
				for ( k=0; k < n_j ; k++) {
					Q.val[Qi + k] -= betavk * Qtv[k];
				}
			}
		};
		
		// Backaccumulation of Q
		for ( k=n-3; k >=0; k--) {
			updateQ(k+1,V[k], beta[k]);
		}
		return Q;
	}
	else
		return T;
}
function givens(a,b,Gi,Gk,n) {
	// compute a Givens rotation:
	var c;
	var s;
	var tau;
	var G;
	
	// Compute c and s
	if ( b == 0) {
		c = 1;
		s = 0;		
	}
	else {
		if ( Math.abs(b) > Math.abs(a) ) {
			tau = -a / b;
			s = 1 / Math.sqrt(1+tau*tau);
			c = s*tau;
		}
		else {
			tau = -b / a;
			c = 1 / Math.sqrt(1+tau*tau);
			s = c * tau;
		}		
	}
	
	if ( arguments.length == 5 ) {
		// Build Givens matrix G from c and s:
		G = eye(n) ;
		G.val[Gi*n+Gi] = c;
		G.val[Gi*n+Gk] = s;
		G.val[Gk*n+Gi] = -s;
		G.val[Gk*n+Gk] = c;
		return G;
	}
	else {
		return [c,s];
	}
	
}
/**
 * @param {number}
 * @param {number}
 * @param {number}  
 * @param {number}
 * @param {Matrix}
 */
function premulGivens ( c, s, i, k, A) {
	// apply a Givens rotation to A : A([i,k],:) = G' * A([i,k],:)
	//  with G = givens (a,b,i,k) and [c,s]=givens(a,b)
	// NOTE: this modifies A

	const n = A.n;
	var j;
	const ri = i*n;
	const rk = k*n;
	var t1;
	var t2;
	for ( j=0; j < n; j++) {
		t1 = A.val[ri + j]; 
		t2 = A.val[rk + j]; 
		A.val[ri + j] = c * t1 - s * t2; 
		A.val[rk + j] = s * t1 + c * t2;
	}	
}
/**
 * @param {number}
 * @param {number}
 * @param {number}  
 * @param {number}
 * @param {Matrix}
 */
function postmulGivens ( c, s, i, k, A) {
	// apply a Givens rotation to A : A(:, [i,k]) =  A(:, [i,k]) * G
	//  with G = givens (a,b,i,k) and [c,s]=givens(a,b)
	// NOTE: this modifies A

	const m = A.length;
	var j;
	var t1;
	var t2;
	var rj = 0;
	for ( j=0; j < m; j++) {
		t1 = A.val[rj + i]; 
		t2 = A.val[rj + k]; 
		A.val[rj + i] = c * t1 - s * t2; 
		A.val[rj + k] = s * t1 + c * t2;
		rj += A.n;
	}	
}

function implicitSymQRWilkinsonShift( T , computeZ) {
	// compute T = Z' T Z
	// if computeZ:  return {T,cs} such that T = Z' T Z  with Z = G1.G2... 
	// and givens matrices Gk of parameters cs[k]

	const n = T.length;
	const rn2 = n*(n-2);
	const rn1 = n*(n-1);

	const d = ( T.val[rn2 + n-2] - T.val[rn1 + n-1] ) / 2;
	const t2 = T.val[rn1 + n-2] * T.val[rn1 + n-2] ;
	const mu = T.val[rn1 + n-1] - t2 / ( d + Math.sign(d) * Math.sqrt( d*d + t2) );
	var x = T.val[0] - mu; // T[0][0]
	var z = T.val[n];		// T[1][0]
	var cs;
	if ( computeZ)
		var csArray = new Array(n-1);
		//var Z = eye(n);
		
	var k;	
	for ( k = 0; k < n-1; k++) {
		/*
		G = givens(x,z, k, k+1, n);
		T = mul(transpose(G), mul(T, G) ); // can do this much faster
		if ( computeZ ) {
			Z = mul(Z, G );
		}
		*/
		cs = givens(x,z);
		postmulGivens(cs[0], cs[1], k, k+1, T);
		premulGivens(cs[0], cs[1], k, k+1, T);
		if( computeZ )
			csArray[k] = [cs[0], cs[1]];
			//postmulGivens(cs[0], cs[1], k, k+1, Z);
		
		if ( k < n-2 ) {
			var r = n*(k+1) + k;
			x = T.val[r];
			z = T.val[r + n]; // [k+2][k];
		}
	}
	if ( computeZ) {
		return {"T": T, "cs": csArray} ;
//		return {"T": T, "Z": Z} ;
	}
	else 
		return T;
}

function eig( A , computeEigenvectors ) {
	// Eigendecomposition of a symmetric matrix A (QR algorithm)
	
	var Q; 
	var D;	
	if ( computeEigenvectors ) {
		D = matrixCopy(A);
		Q = tridiagonalize( D, true );
	}
	else {
		D = tridiagonalize( A ); 
	}	
	
	var q;
	var p;
	const n = A.length;
	var i;
	
	const TOL = 1e-12; //10 * EPS;

	do { 
		for ( i=0; i<n-1; i++) {
			if ( Math.abs( D.val[i*n + i+1] ) < TOL * ( Math.abs(D.val[i*n+i] ) + Math.abs(D.val[(i+1)*n+i+1] ) ) ) {
				D.val[i*n+i+1] = 0;
				D.val[(i+1)*n+i] = 0;
			}
		}

		// find largest q such that D[n-p-q:n][n-p-q:n] is diagonal: 
		if ( !isZero( D.val[(n-1)*n+n-2] )  || !isZero( D.val[(n-2)*n + n-1] )  ) 
			q = 0;
		else {
			q = 1;		
			while ( q < n-1 && isZero( D.val[(n-q-1)*n+ n-q-2] ) && isZero( D.val[(n-q-2)*n + n-q-1] ) )
				q++;	
			if ( q >= n-1 ) 
				q = n;			
		}
		
		// find smallest p such that D[p:q][p:q] is unreduced ( without zeros on subdiagonal?)
		p = -1;
		var zerosOnSubdiagonal ;
		do { 
			p++;
			zerosOnSubdiagonal = false;
			k=p;
			while (k<n-q-1 && zerosOnSubdiagonal == false) {
				if ( isZero ( D.val[(k+1)*n + k] ) )
					zerosOnSubdiagonal = true;
				k++;
			}
		} while (  zerosOnSubdiagonal && p + q < n  ); 

		// Apply implicit QR iteration
		if ( q < n ) {
			
			if ( computeEigenvectors ) {
				var res = implicitSymQRWilkinsonShift( get ( D, range(p,n-q), range(p,n-q)), true);
				set( D, range(p,n-q), range(p,n-q), res.T );
				for ( var kk = 0; kk < n-q-p-1; kk++)
					postmulGivens(res.cs[kk][0], res.cs[kk][1], p+kk, p+kk+1, Q);
				//Z = eye(n);
				//set(Z, range(p,n-q), range(p,n-q), DZ22.Z );
				// Q = mulMatrixMatrix ( Q, Z );	
				
			}
			else {
				set( D, range(p,n-q), range(p,n-q), implicitSymQRWilkinsonShift( get ( D, range(p,n-q), range(p,n-q)) , false)) ;
			}
		}

	} while (q < n ) ;

	if ( computeEigenvectors ) {
		return { "V" : diag(D), "U": Q};
	}	
	else 
		return diag(D);
}

function eigs( A, r, smallest ) {
	// Compute r largest or smallest eigenvalues and eigenvectors
	if( typeof(r) == "undefined")
		var r = 1;
	if( typeof(smallest) == "undefined" || smallest == false || smallest !="smallest" ) {		
		if ( r == 1)
			return eig_powerIteration ( A );
		else 
			return eig_orthogonalIteration ( A , r) ;
	}
	else {
		// look for smallest eigenvalues
		if ( r == 1)
			return eig_inverseIteration ( A , 0);
		else 
			return eig_bisect( A, r);
			//return eig_inverseOrthogonalIteration ( A , r) ;
	}			
}

function eig_powerIteration ( A , u0) {
// Compute the largest eigenvalue and eigenvector with the power method
	const maxIters = 1000;
	var k;
	const n = A.length;
	
	// init with a random u or an initial guess u0
	var u;
	if ( typeof(u0) == "undefined")
		u = randn(n);
	else
		u = u0;
	u = mulScalarVector(1/norm(u), u);
	var lambda = 1;
	for ( k=0; k< maxIters; k++) {		
		// Apply the iteration : u = Au / norm(Au)
		u = mulMatrixVector(A, u) ;
		lambda = norm(u);
		u = mulScalarVector(1/ lambda, u);				
	}
	return { "v" : lambda, "u" : u};
}

function eig_orthogonalIteration ( A, r ) {

	if ( r == 1 )	
		return eig_powerIteration ( A );

// Compute the r largest eigenvalue and eigenvector with the power method (orthogonal iteration)
	const maxIters = 1000;
	var k;
	const n = A.length;
	
	// init with a random Q
	var Q = randn(n,r);
	var normQ = norm(Q,1);
	Q = entrywisediv(Q, mul(ones(n),normQ) );
	var QR;
	var Z; 

	const TOL = 1e-11;
	var V;

	for ( k=0; k< maxIters; k++) {		

		// Z = AQ		
		Z = mulMatrixMatrix(A, Q);
		if ( Math.floor(k / 50) == k / 50) {
			// convergence test
			V = mulMatrixMatrix(transpose(Q), Z);

			if ( norm ( subMatrices ( Z, mulMatrixMatrix(Q, diag(diag(V)) ) ) ) < TOL )
				break;
		}	
			
		// QR = Z	// XXX maybe not do this at every iteration...
		Q = qroriginal(Z,r).Q;	
	
	}

	V = mulMatrixMatrix(transpose(Q), mulMatrixMatrix(A, Q) );

	return {"V": diag(V ), "U" : Q};
}

function eig_inverseIteration ( A, lambda ) {
	// Compute an eigenvalue-eigenvector pair from an approximate eigenvalue with the inverse iteration
	var perturbation = 0.0001*lambda;

	if ( typeof(maxIters) == "undefined" )
		var maxIters = 100;
		
	var k;
	const n = A.length;

	// apply power iteration with (A - lambda I)^-1 instead of A
	var A_lambdaI = sub(A, mul(lambda + perturbation, eye(n) ));
	var QR = qr( A_lambdaI ); // and precompute QR factorization

	while (QR.rank < n) { // check if not singular
		perturbation *= 10;
		A_lambdaI = sub(A, mul(lambda + perturbation, eye(n) ));
		QR = qr( A_lambdaI ); // and precompute QR factorization
		//console.log(perturbation);
	}
	
	// init
	var u = sub(mul(2,rand(n)),1); //ones(n); // 
	u = mulScalarVector( 1/norm(u), u );
	var v;
	var r;
	var norminfA = norminf(A);
	k = 0;
	do {
		// u =  solve(A_lambdaI , u) ;
		
		u = solveWithQRcolumnpivoting ( QR, u ); // QR factorization precomputed
		
		v = norm(u);
		u = entrywisediv(u , v);	

		r = mulMatrixVector(A_lambdaI, u); 
		
		k++;
	} while ( k < maxIters && maxVector(absVector(r)) < 1e-10 * norminfA); // && Math.abs(v * perturbation - 1 ) < EPS );
	return u;

}
function eigenvector ( A, lambda ) {
	return eig_inverseIteration(A, lambda, 2);
} 

function eig_inverseOrthogonalIteration ( A, r ) {

	if ( r == 1 )	
		return eig_inverseIteration ( A );

// Compute the r smallest eigenvalue and eigenvectors with the inverse power method 
// (orthogonal iteration)
	const maxIters = 1000;
	var k;
	const n = A.length;
	var QR = qr( A ); // precompute QR factorization

	// init with a random Q
	var Q = randn(n,r);
	var normQ = norm(Q,1);
	Q = entrywisediv(Q, mul(ones(n),normQ) );
	var QR;
	var Z; 

	const TOL = 1e-11;
	var V;

	for ( k=0; k< maxIters; k++) {		

		// Z = A^-1 Q
		Z = solveWithQRcolumnpivotingMultipleRHS ( QR, Q );
		
		if ( Math.floor(k / 50) == k / 50) {
			// convergence test
			V = mulMatrixMatrix(transpose(Q), Z);

			if ( norm ( subMatrices ( Z, mulMatrixMatrix(Q, V ) ) ) < TOL )
				break;
		}	
			
		// QR = Z	// XXX maybe not do this at every iteration...
		Q = qroriginal(Z,r).Q;	
	
	}

	V = mulMatrixMatrix(transpose(Q), mulMatrixMatrix(A, Q) );

	return {"V": diag(V ), "U" : Q, "iters": k};
}


function eig_bisect( A, K ) {
// find K smallest eigenvalues 

/*
TEST
//Symmetric eigenvalue decomposition
X = rand(5,5)
A = X*X'
v = eig(A)
eig_bisect(A,3)
*/
	
	var x,y,z;
	
	// Tridiagonalize A	
	var T = tridiagonalize( A ); 	
	const n = T.n;
	var a = diag(T);
	var b = zeros(n);
	var i;
	for ( i=0; i < n-1; i++) 
		b[i] =  T.val[i*n + i + 1];
		
	// Initialize [y,z] with Gershgorin disk theorem
	var y0 = a[0] - b[0];
	var z0 = a[0] + b[0];
	for ( var i=1; i < n; i++) {
		var yi = a[i] - b[i] - b[i-1];
		var zi = a[i] + b[i] + b[i-1];
		if( yi < y0 )
			y0 = yi;
		if( zi > z0 )
			z0 = zi;
	}
	
	/*
	// polynomial evaluation and counting sign changes (original method)
	var polya = function (x,a,b,n) {
		var pr_2 = 1;
		var pr_1 = a[0] - x;
		var pr;
		var signchanges = 0;
		if (  pr_1 < EPS )
			signchanges = 1;
			
		var r;
		for ( r = 1; r < n ; r++) {
			pr = (a[r] - x) * pr_1 - b[r-1] * b[r-1] * pr_2;

			if ( Math.abs(pr) < EPS || (pr > 0 &&  pr_1 < 0 ) || (pr < 0) && (pr_1 > 0) )
				signchanges ++;

			pr_2 = pr_1;
			pr_1 = pr;			
		}
		return signchanges;
	};
	*/
	
	// ratio of polynomials evaluation and counting sign changes
	// (modification discussed in Barth et al., 1967 for better stability due to pr ~ 0 in the above)
	var polyq = function (x,a,b,n) {
		var qi_1 = a[0] - x;
		var qi;
		var signchanges = 0;
		if (  qi_1 < EPS )
			signchanges = 1;
			
		var i;
		for ( i = 1; i < n ; i++) {
			qi = (a[i] - x) - b[i-1] * b[i-1] / qi_1;

			if ( qi < EPS ) 
				signchanges ++;

			if ( Math.abs(qi) < EPS )
				qi_1 = EPS;
			else
				qi_1 = qi;			
		}
		return signchanges;
	};


	// Start bisection
	const TOL = 1e-10; 
	var lambda = zeros(K);
	var xu = entrywisemul(z0,ones(K)); // upper bounds on lambdas
	y = y0;
	var n_lowerthan_x;// nb of eigenvalues lower than x
	for ( var k = 1; k <= K ; k++ ) {
		// k is the number of desired eigenvalues in this sweep 
		
		z = xu[k-1];
		//y=y; from previous sweep
		
		// find the (n-k+1)th eigenvalue
		while ( Math.abs(z - y) > TOL*(Math.abs(y) + Math.abs(z)) ) {
			x = (y+z)/2;
			n_lowerthan_x = polyq(x,a,b,n);

			if(n_lowerthan_x  >= k ) 
				z = x; // enough eigenvalues below x, decrease upper bound to x
			else
				y = x; // not enough ev below x, increase lower bound to x
				
			// update boudns on other lambdas
			for ( var j=k+1; j <= K; j++) 
				if ( n_lowerthan_x >= j )
					xu[j-1] = x;			
			
		}
		lambda[k-1] = (y+z)/2;
	}
	//return lambda;
	
	// Compute eigenvectors: XXX can be faster by using inverse iteration on the tridiagonal matrix 
	//						 with faster system solving
	
	var u = eigenvector( A, lambda[0] ); 
	var U = mat([u],false);
	
	for ( k = 1; k < K; k++) {
		// deal with too close eigenvalues
		var perturbtol = 10 * Math.max(EPS, Math.abs(EPS * lambda[k-1])); 
		if ( lambda[k] < lambda[k-1] + perturbtol ) 
			lambda[k] = lambda[k-1] + perturbtol;
	
		u = eigenvector( A, lambda[k] ); 
		U = mat([U, u], false ); 
		U = qroriginal( U, U.n ).Q; // orthogonalize
	}

	
	return {U: U, V: lambda};
}


function bidiagonalize( A, computeU, thinU , computeV ) {
	// B = U' A V , where B is upper bidiagonal

	var j;
	const m = A.length;
	const n = A.n;
	var B;
	B = matrixCopy( A );
	
	var householder; 
	
	if ( computeU ) {
		if ( thinU ) {
			var U = eye(m,n);
			var nU = n;						
		}
		else {
			var U = eye(m);
			var nU = m;
		}
	}
	if ( computeV ) {
		var V = eye(n);		
	}
	
	
	var updateB1 = function (j, v, beta) {
		// B = B - (beta v) ( v'* B) = B-outer(beta v, B'*v)
		//Bjmjn = get ( B, range(j,m), range(j, n));
		//set ( B, range(j,m), range(j,n), sub ( Bjmjn , outerprod ( householder.v, mul(transpose(Bjmjn), householder.v), householder.beta) ) );
			
		var i,k;
		var Btv = zeros(n-j);
		var n_j = n-j;
		var m_j = m-j;
		for ( i=0; i<m_j; i++) {
			var Bi = (i+j)*n + j;
			for ( k=0;k<n_j; k++) 
				Btv[k] += v[i] * B.val[Bi+k];
		}
		for ( i=0; i < m_j; i++) {
			var betavk = beta * v[i];
			var Bi = (i+j)*n + j;
			for ( k=0; k < n_j ; k++) {
				B.val[Bi+k] -= betavk * Btv[k];
			}
		}
	};
	var updateB2 = function (j, v, beta) {
		// B = B - beta (Bv) v' (with B = B_j:m, j+1:n)

		//Bjmjn = get ( B, range(j,m), range(j+1, n));
		//set ( B, range(j,m), range(j+1,n) , sub( Bjmjn, outerprod( mul(Bjmjn, householder.v), householder.v, householder.beta) ) );		
		var i,k;	
		var n_j_1 = n-j-1;
		for ( i=j; i < m; i++) {
			var Bi = i*n + j + 1;
			var Bv = 0;
			for ( k=0;k<n_j_1; k++) 
				Bv += B.val[Bi + k] *  v[k] ;
			var betaBvk = beta * Bv;
			for ( k=0; k < n_j_1 ; k++) {
				B.val[Bi + k] -= betaBvk * v[k];
			}
		}
	};
	
	if ( computeV ) {
		var updateV = function (j, v, beta) {
			//smallV = get ( V, range(0,n), range(j+1, n));
			//set ( V, range(0,n), range(j+1,n) , sub( smallV, outerprod( mul(smallV, householder.v), householder.v, householder.beta) ) );	
			var i,k;	
			var n_j_1 = n-j-1;
			for ( i=0; i < n; i++) {
				var Vi = i*n + j + 1;
				var Vv = 0;
				for ( k=0;k<n_j_1; k++) 
					Vv += V.val[Vi + k] *  v[k] ;
				var betaVvk = beta * Vv;
				for ( k=0; k < n_j_1 ; k++) {
					V.val[Vi + k] -= betaVvk * v[k];
				}
			}
		};
	}
	if ( computeU ) {
		var hv=new Array(n);// Householder vectors and betas
		var hb=new Array(n);
	}
	
	for (j=0; j < n ; j++) {
				
		if ( j < m-1)  {
			householder = house( get ( B, range(j, m), j) );
			
			updateB1(j, householder.v, householder.beta);
			
			if ( computeU ) {				
				hv[j] = vectorCopy(householder.v);
				hb[j] = householder.beta;
				//	updateU(j, householder.v, householder.beta);
			}
		}
				
		if ( j < n-2) {
			householder = house ( B.row(j).subarray(j+1, n) ) ;
			
			updateB2(j, householder.v, householder.beta);
			
			if( computeV ) {
				updateV(j, householder.v, householder.beta);
			
			}	
		}		
	}
	if (computeU) {		
		// Back accumulation of U (works with less than m columns)
		// Un_1 = (I-beta v v')Un = Un - beta v (v' Un)

		/*for (j=n-1;j>=0; j--) {
			if (j<m-1){
				smallU = get(U,range(j,m),[]);
				set(U,range(j,m),[], sub(smallU, mul(bv[j],mul(hv[j], mul(transpose(hv[j]) , smallU)))));
			}
		}*/
		var updateU = function (j, v, beta) {			
			var i,k;
			var vtU = zeros(nU);
			for ( i=j; i<m; i++) {
				var Ui = i*nU;
				var i_j = i-j;
				for ( k=0;k<nU; k++) 
					vtU[k] += v[i_j] * U.val[Ui + k];
			}
			for ( i=j; i < m; i++) {
				var betavk = beta * v[i-j];
				var Ui = i*nU;		
				for ( k=0; k < nU ; k++) {
					U.val[Ui + k] -= betavk * vtU[k];
				}
			}
		};
		var nj = Math.min(n-1,m-2);
		for (j=nj;j>=0; j--) {
				updateU(j,hv[j], hb[j]);
		}
	}

	if ( computeU && computeV ) {
		return { "U" : U, "V": V, "B": B};	 
	}
	else if (computeV )
		return { "V": V, "B": B};
	else if (computeU)
		return { "U" : U, "B": B};	 
	else
		return B;
}


function GolubKahanSVDstep ( B, i, j, m, n, computeUV ) {
	// Apply GolubKahanSVDstep to B(i:i+m, j:j+n)
	// Note: working on Utrans
	if (type ( B ) != "matrix" ) 
		return B;

	if ( n < 2 ) 
		return B;

	const rn2 = (i+n-2)*B.n + j;
	const dm = B.val[rn2 + n-2];
	const fm = B.val[rn2 + n-1];
	var fm_1 ;
	if ( n>2)
		fm_1 = B.val[(i+n-3)*B.n + j + n-2];
	else
		fm_1 = 0;
		
	const dn = B.val[(i+n-1)*B.n + j + n-1];
	
	const d = ( dm*dm + fm_1*fm_1 - dn*dn - fm*fm ) / 2;
	const t2 = dm*fm * dm*fm;
	const mu = dn*dn+fm*fm - t2 / ( d + Math.sign(d) * Math.sqrt( d*d + t2) );

	var k;
	
	//var B0 = getCols ( B, [0]); 
	//var B1 = getCols ( B, [1]) ;
	//var y = mul( B0, B0 ) - mu;
	//var z =  mul( B0, B1 );
	var y = - mu;
	var z = 0.0;
	var r0 = i*B.n + j;
	for ( k = 0; k< n; k++) {
		y += B.val[r0] * B.val[r0];
		z += B.val[r0] * B.val[r0+1];
		r0 += B.n;
	}
	

	var G;	
	var cs;
	
	var postmulgivens = function ( c, s, k1, k2) {
		// apply a Givens rotation to a subset of rows of B : B(i:i+m, [k1,k2]) =  B(i:i+m, [k1,k2]) * G
		var jj;
		var t1;
		var t2;
		var rj = i*B.n + j;
		for ( jj=0; jj < m; jj++) {
			t1 = B.val[rj + k1]; 
			t2 = B.val[rj + k2]; 
			B.val[rj + k1] = c * t1 - s * t2; 
			B.val[rj + k2] = s * t1 + c * t2;
			rj += B.n;
		}	
	}
	var premulgivens = function ( c, s, k1, k2) {
	// apply a Givens rotation to a subset of cols of B : B([k1,k2],j:j+n) = G' * B([k1,k2],j:j+n)
		var jj;
		const ri = (i+k1)*B.n + j;
		const rk = (i+k2)*B.n + j;
		var t1;
		var t2;
		for ( jj=0; jj < n; jj++) {
			t1 = B.val[ri + jj]; 
			t2 = B.val[rk + jj]; 
			B.val[ri + jj] = c * t1 - s * t2; 
			B.val[rk + jj] = s * t1 + c * t2;
		}	
	}
	
	if ( computeUV) {
		//var U = eye(m);
		//var V = eye(n);
		var csU = new Array(n-1);
		var csV = new Array(n-1);		
	}

	for ( k = 0; k < n-1 ; k++) {
		cs = givens(y,z);
		postmulgivens(cs[0],cs[1], k, k+1);
		
		if ( computeUV ) {
			csV[k] = [cs[0], cs[1]];
			//	postmulGivens(cs[0],cs[1], k, k+1, V);
		}
			
			
		y = B.val[(i+k)*B.n + j + k];
		z = B.val[(i+k+1)*B.n + j + k];
			
		cs = givens(y,z);
		premulgivens(cs[0],cs[1], k, k+1);
	
		if ( computeUV ) {
			csU[k] = [cs[0], cs[1]];
			//premulGivens(cs[0],cs[1], k, k+1, U);
		}

		if ( k < n-2 ) {
			y = B.val[(i+k)*B.n + j + k+1];
			z = B.val[(i+k)*B.n + j + k+2];
		}
			
	}

	if ( computeUV) 
		return {csU: csU, csV: csV};
}

function svd( A , computeUV ) {
/* TEST:
A=[ [-149,-50,-154],[537,180,546],[-27,-9,-25]]
s=svd(A)
should return [ 817.7597, 2.4750, 0.0030]
*/	

	if ( type(A) == "vector" || (type(A) == "matrix" && A.n == 1) ) {
		return { "U" : matrixCopy(A), "S" : ones(1,1), "V" : ones(1,1), "s" : [1] };
	}
	if ( A.m == 1) {
		return { "U" : ones(1,1), "S" : ones(1,1), "V" : transpose(A), "s" : [1] };
	}
	

	var i;
	var m = A.length;
	var n = A.n; 
	
	
	var Atransposed = false;
	if ( n > m ) {
		Atransposed = true;
		var At = transposeMatrix(A);
		n = m;
		m = At.length;
	}
	
	var computeU = false;
	var computeV = false; 
	var thinU = false;
	if ( typeof( computeUV) != "undefined" && computeUV!==false)  {
	
		if ( computeUV === "full" ) {
			computeU = true; 
			computeV = true;
			thinU = false;
		}
		else if (computeUV === true || computeUV === "thin" ) {
			computeU = true; 
			computeV = true;
			thinU = true;
		}
		else if ( typeof(computeUV) == "string") {
			if ( computeUV.indexOf("U") >=0 )
				computeU = true;
			if ( computeUV.indexOf("V") >=0 )
				computeV = true;
			if ( computeUV.indexOf("thin") >=0 )
				thinU = true;
		}
		var UBV;		
		if ( Atransposed ) {
			var tmp = computeU;
			computeU = computeV;
			computeV = tmp;
			UBV = bidiagonalize( At, computeU, thinU, computeV );
		}
		else
			UBV =  bidiagonalize( A, computeU, thinU, computeV );

		if ( computeU ) {
			var U = transpose(UBV.U);//Utrans
		}
		else
			var U = undefined;
			
		if( computeV ) {	
			var V = UBV.V;
			var Vt = transposeMatrix(V);
		}
		else
			var V = undefined;

		var B = UBV.B;
	}
	else {
		if ( Atransposed ) 
			var B = bidiagonalize( At, false, false, false );
		else
			var B = bidiagonalize( matrixCopy(A), false, false, false );
	}

	var B22;
	var U22;
	var V22;
	var cs;
	
	var q;
	var p;
	var k;

	const TOL = 1e-11;
	var iter = 0;
	do {
		
		for ( i=0; i<n-1; i++) {
			if ( Math.abs( B.val[i*B.n + i+1] ) < TOL * ( Math.abs(B.val[i*B.n + i]) + Math.abs(B.val[(i+1) * B.n + i+1]) ) ) {
				B.val[i*B.n + i+1] = 0;
			}
		}

		// find largest q such that B[n-q+1:n][n-q+1:n] is diagonal (in matlab notation): 
		q = 0;		
		while ( q < n && Math.abs( B.val[(n-q-1)*B.n + n-q-2] ) < TOL && Math.abs( B.val[(n-q-2)*B.n + n-q-1] ) < TOL ) {
			q++;	
		}
		if ( q == n-1 )
			q = n;
				
		// find smallest p such that B[p+1:n-q][p+1:n-q] has no zeros on superdiag (in matlab notation):
		p=0;	// size of B11 = first index of B22 in our notation
		while ( p < n-q && Math.abs( B.val[p*B.n + p+1] ) < TOL * ( Math.abs(B.val[p*B.n + p]) + Math.abs(B.val[(p+1) * B.n + (p+1)]) )  ) {
			p++;
		}
		
		if ( q < n ) {
			var DiagonalofB22isZero = -1;
			for ( k=p; k< n-q ; k++) {
				if ( Math.abs(  B.val[k*B.n + k] ) < TOL ) {
					DiagonalofB22isZero = k;
					break; 
				}
			}
			if ( DiagonalofB22isZero >= 0 ) {
				if ( DiagonalofB22isZero < n-q-1 ) {
					// Zero B(k,k+1) and entire row k...
			  		for (k=DiagonalofB22isZero+1; k < n; k++) {	

						cs = givens( B.val[k*B.n + k] , B.val[DiagonalofB22isZero * B.n + k] );
						premulGivens(cs[0],cs[1], k,DiagonalofB22isZero, B);
						if ( computeU ) 
							premulGivens(cs[0],cs[1], k, DiagonalofB22isZero, U);		
					}
				}
				else {
					// Zero B(k-1,k) and entire column k...
		      		for (k=n-q-2; k >= p; k--) {
						 
						cs = givens(B.val[k*B.n + k] , B.val[k*B.n + n-q-1] );
						postmulGivens(cs[0],cs[1], k, n-q-1, B);
						if ( computeV ) 
							premulGivens(cs[0],cs[1], k, n-q-1, Vt);
//							postmulGivens(cs[0],cs[1], j, n-q-1, V);
					}
				}
			}
			else {
				//B22 = get ( B, range(p , n - q ) , range (p , n-q ) );	

				if ( computeUV ) {
					// UBV = GolubKahanSVDstep( B22, true ) ;
					// set ( U, range(p,n-q), [], mul(UBV.U, get(U, range(p,n-q), []) ) );
					// set ( Vt, range(p,n-q), [], mul(transpose(UBV.V), getRows(Vt, range(p,n-q)) ) );

					var GKstep = GolubKahanSVDstep( B, p, p, n-q-p, n-q-p, true ) ;// this updates B22 inside B
					for ( var kk=0; kk < n-q-p-1; kk++) {
						if ( computeU )
							premulGivens(GKstep.csU[kk][0], GKstep.csU[kk][1], p+kk, p+kk+1, U);
						if ( computeV )
							premulGivens(GKstep.csV[kk][0], GKstep.csV[kk][1], p+kk, p+kk+1, Vt); // premul because Vtransposed
					}												
				}
				else {
					GolubKahanSVDstep( B, p, p, n-q-p, n-q-p ) ;
				}
				//set ( B , range(p , n - q ) , range (p , n-q ), B22  );			
			}		
		}
		iter++;
	} while ( q < n) ;

	if (computeUV ) {
	
		if ( computeV)
			V = transposeMatrix(Vt);
	
		// Correct sign of singular values:
		var s = diag(B);
		var signs = zeros(n);
		for ( i=0; i< n; i++) {
			if (s[i] < 0) {
				if ( computeV )
					set(V, [], i, minus(get(V,[],i)));
				s[i] = -s[i];
			}
		}

		// Rearrange in decreasing order: 
		var indexes = sort(s,true, true);
		if(computeV)
			V = get( V, [], indexes);
		if(computeU) {
			if ( !thinU) {
				for ( i=n; i < m; i++)
					indexes.push(i);
			}
			U = get(U, indexes,[]) ;
		}
		
		if ( thinU )
			var S = diag(s) ;
		else
			var S = mat([diag(s), zeros(m-n,n)],true) ;
		
		var Ut = undefined;
		if ( computeU )
			Ut = transpose(U);
			
		if ( Atransposed ) {
			if ( thinU )
				return { "U" : V, "S" : S, "V" : Ut, "s" : s };			
			else
				return { "U" : V, "S" : transpose(S), "V" : Ut, "s" : s };
		}		
		else {
			return { "U" : Ut, "S" : S, "V" : V, "s" : s };
		}
	}
	else 
		return sort(abs(diag(B)), true);
}

function rank( A ) {
	const s = svd(A);
	var rank = 0;
	var i;
	for ( i=0;i < s.length;i++)
		if ( s[i] > 1e-10 )
			rank++;
			
	return rank;
}

function nullspace( A ) {
	// Orthonormal basis for the null space of A
	const s = svd( A, "V" ) ; 
	const n = A.n;

	var rank = 0;
	const TOL = 1e-8; 
	while ( rank < n && s.s[rank] > TOL )
		rank++;

	if ( rank < n ) 
		return get ( s.V, [], range(rank, n) );
	else
		return zeros(n);
	
}

function orth( A ) {
	// Orthonormal basis for the range of A
	const s = svd( A, "thinU" ) ; 
	const n = A.n;

	var rank = 0;
	const TOL = 1e-8; 
	while ( rank < n && s.s[rank] > TOL )
		rank++;
	
	return get ( s.U, [], range(0,rank) );
	
}

/////////////////////////////
//// Sparse matrix and vectors 
/////////////////////////////

/**
 *
 * new spVector(n) => allocate for n nonzeros with dim n
 * new spVector(n, nnz) => allocate for nnz nonzeros out of n
 * new spVector(n,values,indexes) => allocate for values.length nonzeros
 *
 * @constructor
 * @struct
 */
function spVector(n, values, indexes) {
	
	/** @const */ this.length = n;
	/** @const */ this.size = [n,1];
	/** @const */ this.type = "spvector";
	
	if ( arguments.length <= 2) {
		if ( arguments.length == 1)
			var nnz = n;		// too large but more efficient at some point...
		else
			var nnz = values;
			
		/** @type{Float64Array} */ this.val = new Float64Array(nnz);  // nz values
		/** @type{Uint32Array} */ this.ind = new Uint32Array(nnz);   // ind[k] = index of val[k]
	}
	else {
		var nnz = values.length;
		/** @type{Float64Array} */ this.val = new Float64Array(values);  // nz values
		/** @type{Uint32Array} */ this.ind = new Uint32Array(indexes);   // ind[k] = index of val[k]
	}
	
	/** @const */ this.nnz = nnz;	
}
/*
 * @param{number}
 * @return{number}
 */
spVector.prototype.get = function ( i ) {
	var k = this.ind.indexOf(i);
	if ( k < 0 )
		return 0;
	else
		return this.val[k];
}
/*
 * @param{number}
 * @param{number}
 */
spVector.prototype.set = function ( i, value ) {
	// Inefficient do not use this, use sparse(x) instead
	if ( i > this.n ) {
		error( "Error in spVector.set(i,value): i > this.length)");
		return undefined;
	}
	var k = this.ind.indexOf(i);
	if ( k < 0 ) {
		var ind = new Uint32Array(this.nnz + 1);
		var val = new Float64Array(this.nnz + 1);
		k = 0; 
		while ( this.ind[k] < i ) { // copy values until i
			ind[k] = this.ind[k];	// making sure this.ind remains sorted
			val[k] = this.val.ind[k];
			k++;
		}
		ind[k] = i;// insert value
		val[k] = value;
		ind.set(this.ind.subarray(k), k+1);// copy rest of vector
		val.set(this.val.subarray(k), k+1);
		this.nnz++;
	}
	else 
		this.val[k] = value;
		
	return value;
}
/*
 * @return{spVector}
 */
spVector.prototype.copy = function () {
	return new spVector(this.n, this.val, this.ind);	
}

/**
 *
 * new spMatrix(m,n) => allocate for m*n nonzeros
 * new spMatrix(m,n, nnz) => allocate for nnz nonzeros
 * new spMatrix(m,n,values,cols,rows) => allocate for values.length nonzeros
 *
 * @constructor
 * @struct
 */
function spMatrix(m,n, values, cols, rows) {
	
	/** @const */ this.length = m;
	/** @const */ this.m = m;
	/** @const */ this.n = n;
	/** @const */ this.size = [m,n];
	/** @const */ this.type = "spmatrix";
	
	if ( arguments.length <= 3) {
		if ( arguments.length == 2)
			var nnz = m*n;		// too large but more efficient at some point...
		else
			var nnz = values;
			
		/** @type{boolean} */ this.rowmajor = true;
		/** @type{Float64Array} */ this.val = new Float64Array(nnz);  // nnz values
		/** @type{Uint32Array} */ this.cols = new Uint32Array(nnz); // cols[k] = col of val[k]
		/** @type{Uint32Array} */ this.rows = new Uint32Array(m+1);   // rows[i] = starting index of row i in val and cols
	}
	else {
		var nnz = values.length;
		if ( rows.length == nnz && cols.length == n+1 && cols[cols.length-1] == nnz ) {
			/** @type{boolean} */ this.rowmajor = false;
			/** @type{Float64Array} */ this.val = new Float64Array(values);  // nz values
			/** @type{Uint32Array} */ this.cols = new Uint32Array(cols); // cols[j] = starting index of col j in val and rows
			/** @type{Uint32Array} */ this.rows = new Uint32Array(rows);   // rows[k] = row of val[k]		
		}
		else {
			/** @type{boolean} */ this.rowmajor = true;
			/** @type{Float64Array} */ this.val = new Float64Array(values);  // nz values
			/** @type{Uint32Array} */ this.cols = new Uint32Array(cols); // cols[k] = col of val[k]	
			/** @type{Uint32Array} */ this.rows = new Uint32Array(rows);   // rows[i] = starting index of row i in val and cols
		}
	}
	
	/** @const */ this.nnz = nnz;
	
}
/*
 * @return{spMatrix}
 */
spMatrix.prototype.copy = function () {
	return new spMatrix(this.m, this.n, this.val, this.cols, this.rows);	
}
/*
 * @return{spMatrix}
 */
spMatrix.prototype.toRowmajor = function () {
	if ( this.rowmajor ) 
		return this.copy();
	else {
		return sparseMatrixRowMajor( fullMatrix(this) );
	}
}
/*
 * Get a pointer to the spVector for row i
 * @return{spVector}
 */
spMatrix.prototype.row = function ( i ) {
	if ( this.rowmajor ) {
		return new spVector(this.n, this.val.subarray(this.rows[i], this.rows[i+1]), this.cols.subarray(this.rows[i], this.rows[i+1]));	
	/*
		var s = this.rows[i];
		var e = this.rows[i+1];
		var vec = new spVector(this.n);
		vec.val.set(this.val.subarray(s,e));
		vec.ind.set(this.cols.subarray(s,e));
		return vec;*/
	}
	else {
		error ("Cannot extract sparse row from a sparse matrix in column major format.");
		return undefined;
	}
}
/*
 * Get a pointer to the spVector for column j
 * @return{spVector}
 */
spMatrix.prototype.col = function ( j ) {
	if ( ! this.rowmajor )
		return new spVector(this.m, this.val.subarray(this.cols[j], this.cols[j+1]), this.rows.subarray(this.cols[j], this.cols[j+1]));	
	else {
		error ("Cannot extract sparse column from a sparse matrix in row major format.");
		return undefined;
	}
}

/*
 * @param{number}
 * @param{number} 
 * @return{number}
 */
spMatrix.prototype.get = function ( i, j ) {
	if ( this.rowmajor ) {
		var rowind =  this.cols.subarray(this.rows[i], this.rows[i+1]);
		var k = rowind.indexOf(j);
		if ( k < 0 )
			return 0;
		else
			return this.val[this.rows[i] + k];	
	}
	else {
		var colind =  this.rows.subarray(this.cols[j], this.cols[j+1]);
		var k = colind.indexOf(i);
		if ( k < 0 )
			return 0;
		else
			return this.val[this.cols[j] + k];
	}
}

function spgetRows(A, rowsrange) {
	var n = rowsrange.length;
	if ( A.rowmajor) {
		if ( n > 1 ) {

			var rowsidx = sort(rowsrange);
			var Ai = new Array(n);
			var nnz = 0;
			for ( var i = 0; i < n; i++) {
				Ai[i] = A.row(rowsidx[i]);
				nnz += Ai[i].val.length;
			}
			var val = new Float64Array( nnz );
			var cols = new Uint32Array( nnz );
			var rows = new Uint32Array( n+1 );
			var k = 0;
			for ( var i = 0; i < n; i++) {
				rows[i] = k;
				val.set(Ai[i].val, k);
				cols.set(Ai[i].ind, k);
				k += Ai[i].val.length;
			}
			rows[i] = k;
			return new spMatrix(n, A.n, val, cols, rows);
		}
		else
			return A.row( rowsrange[0] ) ;
	}
	else {
		return getRows(fullMatrix(A), rowsrange);
	}
}

/**
 * Return the full/dense version of the vector
 * @param{spVector} 
 * @return{Float64Array}
 */
function fullVector (x) {
	var k;
	const n = x.length;
	const nnz = x.val.length;
	var a = new Float64Array(n);
	
	for ( k=0; k < nnz; k++) 
		a[x.ind[k]] = x.val[k];
	
	return a;
}
/**
 * Return the full/dense version of the matrix
 * @param{spMatrix} 
 * @return{Matrix}
 */
function fullMatrix (S) {
	const n = S.n;
	if ( S.rowmajor ) {
		var k;
		const m = S.m;
		var A = new Float64Array(m * n);
		var ri = 0;
		for (var i = 0; i < m; i++) {
			var s = S.rows[i];
			var e = S.rows[i+1];
			for ( k=s; k < e; k++) {
				A[ri + S.cols[k] ] = S.val[k];
			}
			ri += n;
		}
		return new Matrix(m, n, A, true);
	}
	else {
		var k;
		var A = new Float64Array(S.m * n);
		for (var j = 0; j < n; j++) {
			var s = S.cols[j];
			var e = S.cols[j+1];
			for ( k=s; k < e; k++) {
				var i = S.rows[k];
				A[i*n + j] = S.val[k];
			}
		}
		return new Matrix(S.m, n, A, true);
	}
}
function full( A ) {
	switch(type(A)) {
	case "spvector": 
		return fullVector(A);
		break;
	case "spmatrix":
		return fullMatrix(A);
		break;
	default:
		return A;
		break;
	}
}

/**
 * @param{Float64Array}
 * @return{spVector}
 */
function sparseVector( a ) {
	var i,k;
	const n = a.length;
	var val = new Array();
	var ind = new Array();
	for ( i=0; i < n; i++) {
		if (!isZero(a[i]) ) {
			val.push(a[i]);
			ind.push(i);
		}
	}		
	return new spVector(n,val,ind);
}
/**
 * @param{Matrix}
 * @return{spMatrix}
 */
function sparseMatrix( A ) {
	var i,j;
	const m = A.m;
	const n = A.n;
	var val = new Array();
	var rows = new Array();
	var cols = new Uint32Array(n+1);
	var k;
	for ( j=0; j< n; j++) {
		k = j;
		for ( i=0; i < m; i++) {
			// k = i*n+j;
			if (!isZero(A.val[k]) ) {
				val.push(A.val[k]);
				rows.push(i);
				cols[j+1]++;
			}	
			k += n;	
		}		
	}	
	for ( j=1; j< n; j++) 
		cols[j+1] += cols[j];
	
	return new spMatrix(m,n,val,cols,rows);
}
/**
 * @param{Matrix}
 * @return{spMatrix}
 */
function sparseMatrixRowMajor( A ) {
	var i,j;
	const m = A.m;
	const n = A.n;
	var val = new Array();
	var cols = new Array();
	var rows = new Uint32Array(m+1);
	var k = 0;
	for ( i=0; i < m; i++) {
		for ( j=0; j< n; j++) {
			// k = i*n+j;
			if (!isZero(A.val[k]) ) {
				val.push(A.val[k]);
				rows[i+1]++;
				cols.push(j); 
			}		
			k++;
		}		
	}	
	for ( i=1; i< m; i++) 
		rows[i+1] += rows[i];
	
	return new spMatrix(m,n,val,cols,rows);
}

function sparse( A , rowmajor ) {
	if(typeof(rowmajor) == "undefined" ) 
		var rowmajor = true;
		
	switch(type(A)) {
	case "vector": 
		return sparseVector(A);
		break;	
	case "matrix":
		if ( rowmajor )
			return sparseMatrixRowMajor(A);
		else
			return sparseMatrix(A);
		break;
	case "spvector":
	case "spmatrix":
		return A.copy();
		break;
	default:
		return A;
		break;
	}
}

/**
 * @param{number}
 * @return{spMatrix}
 */
function speye(m,n) {
	if ( typeof(n) == "undefined" ) 
		var n = m;
	if ( m == 1 && n == 1)
		return 1;
	
	var e = (m<n)?m:n;
	
	var val = ones(e);
	var rows = range(e+1);
	var cols = rows.slice(0,e);
	return new spMatrix(m,n,val,cols,rows);
}
/**
 * @param{Float64Array}
 * @return{spMatrix}
 */
function spdiag(val) {
	var n = val.length;
	var rows = range(n+1);
	var cols = rows.slice(0,n);
	var tv = type(val);
	if ( tv == "vector")
		return new spMatrix(n,n,val,cols,rows);
	else {
		error("Error in spdiag( x ): x is a " + tv + " but should be a vector.");
		return undefined;
	}
}

/**
 * @param{spVector}
 * @return{Matrix}
 */
function transposespVector (a) {
	return new Matrix(1,a.length, fullVector(a), true);
}
/**
 * @param{spMatrix}
 * @return{spMatrix}
 */
function transposespMatrix (A) {
	return new spMatrix(A.n, A.m, A.val, A.rows, A.cols);
	/*
	const m = A.m;
	const n = A.n;
	
	var At = zeros(n, m);	
	for ( var j=0; j < n; j++) {
		var s = A.cols[j];
		var e = A.cols[j+1];

		for ( var k=s;k < e; k++) {
			At[ rj + A.rows[k] ] = A.val[k];
		}
		rj += m;
	}
	return sparseMatrix(At);
	*/
}



/** Concatenate sparse matrices/vectors
 * @param {Array} 
 * @param {boolean}
 * @return {spMatrix}
 */
function spmat( elems, rowwise ) {
	var k;
	var elemtypes = new Array(elems.length);
	for ( k=0; k < elems.length; k++) {
		elemtypes[k] = type(elems[k]);
	}
		
	if ( typeof(rowwise) == "undefined")
		var rowwise = true;
		
	if ( elems.length == 0 ) {
		return []; 
	}

	var m = 0;
	var n = 0;
	var nnz = 0;
	var i;
	var j;
	if ( rowwise ) {
		var res = new Array( ) ;
		
		for ( k= 0; k<elems.length; k++) {
			switch( elemtypes[k] ) {

			case "vector": // vector (auto transposed)
				var v = sparseVector(elems[k]);
				res.push ( v ) ;
				m += 1;
				n = elems[k].length;
				nnz += v.val.length;
				break;			
			
			case "spvector":
				res.push(elems[k]);
				n = elems[k].length;
				m += 1;
				nnz += elems[k].val.length;
				break;
				
			case "spmatrix":
				for ( var r=0; r < elems[k].m; r++)
					res.push(elems[k].row(r));
				res.push(elems[k]);
				n = elems[k].length;
				m += 1;
				nnz += elems[k].val.length;
				
				break;
				
			default:
				return undefined;
				break;
			}
		}
		
		var M = new spMatrix( m , n , nnz ) ;
		var p = 0;
		M.rows[0] = 0;		
		for (k=0; k < res.length ; k++) {
			if ( res[k].val.length > 1 ) {
				M.val.set( new Float64Array(res[k].val), p);
				M.cols.set( new Uint32Array(res[k].ind), p);
				M.rows[k+1] = M.rows[k] + res[k].val.length;
				p += res[k].val.length;
			}
			else if (res[k].val.length == 1) {
				M.val[p] = res[k].val[0];
				M.cols[p] = res[k].ind[0];
				M.rows[k+1] = M.rows[k] + 1;
				p += 1;			
			}
				
		}
		return M;
	}
	else {
		// not yet...
		
		error("spmat(..., false) for columnwise concatenation of sparse vectors not yet implemented");
		
		return res;
	}
}



/**
 * @param{number}
 * @param{spVector}
 * @return{spVector}
 */
function mulScalarspVector (a, b) {
	const nnz = b.val.length;
	var c = b.copy();
	for ( var k=0;k < nnz; k++) 
		c.val[k] *= a;	
	return c;
}
/**
 * @param{number}
 * @param{spMatrix}
 * @return{spMatrix}
 */
function mulScalarspMatrix (a, B) {
	const nnz = B.nnz;
	var C = B.copy();
	for ( var k=0;k < nnz; k++) 
		C.val[k] *= a;	
	return C;
}

/**
 * @param{spVector}
 * @param{spVector}
 * @return{number}
 */
function spdot (a, b) {
	const nnza = a.val.length;
	const nnzb = b.val.length;
	var c = 0;
	var ka = 0;
	var kb = 0;	
	while ( ka < nnza && kb < nnzb ){
		var i = a.ind[ka]; 
		while ( b.ind[kb] < i && kb < nnzb)
			kb++;
		if(b.ind[kb] == i)
			c += a.val[ka] * b.val[kb];	
		ka++;
	}
	return c;
}
/**
 * @param{spVector}
 * @param{Float64Array}
 * @return{number}
 */
function dotspVectorVector (a, b) {
	const nnza = a.val.length;
	var c = 0;
	for ( var ka=0;ka < nnza; ka++) 
		c += a.val[ka] * b[a.ind[ka]];
	
	return c;
}
/**
 * @param{Matrix}
 * @param{spVector}
 * @return{Float64Array}
 */
function mulMatrixspVector (A, b) {
	const m = A.m;
	const n = A.n;
	const nnz = b.val.length;
	var c = zeros(m);
	var ri = 0;
	for ( var i=0;i < n; i++) {
		for ( var k=0; k < nnz; k++) 
			c[i] += A.val[ri + b.ind[k]] * b.val[k];
		ri+=n;
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function mulspMatrixVector (A, b) {
	const m = A.m;
	const n = A.n;
	var c = zeros(m);
	if ( A.rowmajor) {
		for(var i=0; i < m; i++) {
			var s = A.rows[i];
			var e = A.rows[i+1];
			for(var k = s; k < e; k++) {
				c[i] += A.val[k] * b[A.cols[k]];
			}
		}
	}
	else {
		for ( var j=0;j < n; j++) {
			var s = A.cols[j];
			var e = A.cols[j+1];
			var bj = b[j];
			for ( var k= s; k < e; k++) {
				c[A.rows[k]] += A.val[k] * bj;
			}
		}
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function mulspMatrixTransVector (A, b) {
	const m = A.m;
	const n = A.n;
	var c = zeros(n);
	if ( A.rowmajor ) {
		for ( var j=0;j < m; j++) {
			var s = A.rows[j];
			var e = A.rows[j+1];
			var bj = b[j];
			for ( var k= s; k < e; k++) {
				c[A.cols[k]] += A.val[k] * bj;
			}
		}
	}
	else {
		for ( var j=0;j < n; j++) {
			var s = A.cols[j];
			var e = A.cols[j+1];
			for ( var k= s; k < e; k++) {
				c[j] += A.val[k] * b[A.rows[k]];
			}
		}
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{spVector}
 * @return{Float64Array}
 */
function mulspMatrixspVector (A, b) {
	const m = A.m;
	const n = A.n;
	var c = zeros(m);
	const nnzb = b.val.length;
	if ( A.rowmajor) {
		for(var i=0; i < m; i++) {
			c[i] = spdot(A.row(i), b);
		}
	}
	else {
		for ( var kb=0;kb < nnzb; kb++) {
			var j = b.ind[kb];		
			var bj = b.val[kb];
			var s = A.cols[j];
			var e = A.cols[j+1];

			for ( var k= s; k < e; k++) {
				c[A.rows[k]] += A.val[k] * bj;
			}
		}
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{spVector}
 * @return{Float64Array}
 */
function mulspMatrixTransspVector (A, b) {
	const m = A.m;
	const n = A.n;
	var c = zeros(n);
	const nnzb = b.val.length;
	if (A.rowmajor) {
		for ( var kb=0;kb < nnzb; kb++) {
			var j = b.ind[kb];		
			var bj = b.val[kb];
			var s = A.rows[j];
			var e = A.rows[j+1];
			for ( var k= s; k < e; k++) {
				c[A.cols[k]] += A.val[k] * bj;
			}
		}
	}
	else {
		for ( var i= 0; i < n; i++) {
			var kb = 0;
			var s = A.cols[i];
			var e = A.cols[i+1];

			for ( var ka=s;ka < e; ka++) {
				var j = A.rows[ka]; 
				while ( b.ind[kb] < j && kb < nnzb)
					kb++;
				if(b.ind[kb] == i)
					c[i] += A.val[ka] * b.val[kb];	
			}
		}
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{spMatrix} 
 * @return{Matrix}
 */
function mulspMatrixspMatrix (A, B) {
	const m = A.m;
	const n = A.n;
	const n2 = B.n;
	var c = zeros(m, n2);

	if ( A.rowmajor ) {
		if ( B.rowmajor ) {
			for ( var ic = 0; ic < m; ic++) {
				var sa = A.rows[ic];
				var ea = A.rows[ic+1];
	
				for ( var ka = sa; ka < ea; ka++) {
					var j = A.cols[ka];
					var aj = A.val[ka];
		
					var s = B.rows[j];
					var e = B.rows[j+1];

					var rc = ic * n2 ;
					for (var k= s; k < e; k++) {						
						c.val[rc + B.cols[k] ] += aj * B.val[k] ;
					}
				}
			}
		}
		else {
			var kc = 0;
			/*
			for ( var i=0; i < m; i++) {
				for ( var j=0; j < n2; j++) {
					c.val[kc] = spdot(A.row(i), B.col(j));
					kc++;
				}
			}
			*/
			for ( var i=0; i < m; i++) {
				var sa = A.rows[i];
				var ea = A.rows[i+1];
					
				for ( var j=0; j < n2; j++) {
					
					var eb = B.cols[j+1];
					var ka = sa;
					var kb = B.cols[j];	
					while ( ka < ea && kb < eb ){
						var aj = A.cols[ka]; 
						while ( B.rows[kb] < aj && kb < eb)
							kb++;
						if(B.rows[kb] == aj && kb < eb)
							c.val[kc] += A.val[ka] * B.val[kb];	
						ka++;
					}

					kc++;
				}
			}
		}
	}
	else {
		if ( B.rowmajor ) {
			for (var ja=0;ja < n; ja++) {
				var sa = A.cols[ja];
				var ea = A.cols[ja+1];
				var sb = B.rows[ja];
				var eb = B.rows[ja+1];					
				for ( var ka = sa; ka < ea; ka++) {
					var rc = A.rows[ka] * n2;
					var aij = A.val[ka];
					
					for(var kb = sb; kb < eb; kb++) {
						c.val[rc  + B.cols[kb]] += aij * B.val[kb];	
					}										
				} 
			}
		}
		else {
			for ( var jc = 0; jc < n2; jc++) {
				var sb = B.cols[jc];
				var eb = B.cols[jc+1];
	
				for ( var kb = sb; kb < eb; kb++) {
					var j = B.rows[kb];
					var bj = B.val[kb];
		
					var s = A.cols[j];
					var e = A.cols[j+1];

					for (var k= s; k < e; k++) {
						c.val[A.rows[k] * n2 + jc] += A.val[k] * bj;
					}
				}
			}
		}
	}
	return c;
}
/**
 * @param{Matrix}
 * @param{spMatrix} 
 * @return{Matrix}
 */
function mulMatrixspMatrix (A, B) {
	const m = A.m;
	const n = A.n;
	const n2 = B.n;
	var c = zeros(m, n2);
	
	if ( B.rowmajor ) {
		for (var ja=0;ja < n; ja++) {
			var sb = B.rows[ja];
			var eb = B.rows[ja+1];					
			for ( var i = 0; i < m; i++) {
				var rc = i * n2;
				var aij = A.val[i * n + ja];
				
				for(var kb = sb; kb < eb; kb++) {
					c.val[rc  + B.cols[kb]] += aij * B.val[kb];	
				}										
			}
		}
	}
	else {
		for ( var jc = 0; jc < n2; jc++) {
			var sb = B.cols[jc];
			var eb = B.cols[jc+1];
	
			for ( var kb = sb; kb < eb; kb++) {
				var j = B.rows[kb];
				var bj = B.val[kb];
		
				for ( i= 0; i < m; i++) {
					c.val[i * n2 + jc] += A.val[i*n + j] * bj;
				}
			}
		}
	}
	return c;
}

/**
 * @param{spMatrix}
 * @param{Matrix} 
 * @return{Matrix}
 */
function mulspMatrixMatrix (A, B) {
	const m = A.m;
	const n = A.n;
	const n2 = B.n;
	var c = zeros(m, n2);

	if ( A.rowmajor ) {
		for(var i=0; i < m; i++) {
			var sa = A.rows[i];
			var ea = A.rows[i+1];
			for(var ka = sa; ka < ea; ka++) {
				var ai = A.val[ka];
				var rb = A.cols[ka] * n2;
				var rc = i*n2;
				for ( j=0; j < n2; j++) {
					c.val[rc + j] += ai * B.val[rb + j];
				}				
			}
		}
	}
	else {
		for(var j=0; j < n; j++) {
			var s = A.cols[j];
			var e = A.cols[j+1];

			for ( var k= s; k < e; k++) {
				var i = A.rows[k];
				for ( var jc = 0; jc < n2; jc++) 
					c.val[i*n2 + jc ] += A.val[k] * B.val[j*n2 + jc];
			}
		}
	}
	return c;
}

/**
 * @param{spVector}
 * @param{spVector}
 * @return{spVector}
 */
function entrywisemulspVectors (a, b) {
	const nnza = a.val.length;
	const nnzb = b.val.length;
	var val = new Array();
	var ind = new Array();
	
	var ka = 0;
	var kb = 0;	
	while ( ka < nnza && kb < nnzb ){
		var i = a.ind[ka]; 
		while ( b.ind[kb] < i && kb < nnzb)
			kb++;
		if(b.ind[kb] == i) {
			var aibi = a.val[ka] * b.val[kb];
			if ( !isZero(aibi) ) {
				val.push(aibi);	
				ind.push(i);
			}
		}
		ka++;
	}
	return new spVector(a.length, val, ind);
}
/**
 * @param{spVector}
 * @param{Float64Array}
 * @return{spVector}
 */
function entrywisemulspVectorVector (a, b) {
	// fast operation but might not yield optimal nnz:
	var c = a.copy();	
	const nnz = a.val.length;
	for ( var k = 0; k< nnz; k++) {
		c.val[k] *= b[a.ind[k]];
	}
	return c;
}
/**
 * @param{spMatrix}
 * @param{spMatrix}
 * @return{spMatrix}
 */
function entrywisemulspMatrices (A, B) {
	if ( A.rowmajor ) {
		if ( B.rowmajor ) {
			var val = new Array();
			var cols = new Array();
			var rows = new Uint32Array(A.m+1);
			var ka;
			var kb;
			var i;	
			for ( i=0; i < A.m; i++) {
				ka = A.rows[i];
				kb = B.rows[i];
				var ea = A.rows[i+1];
				var eb = B.rows[i+1];
				while ( ka < ea & kb < eb ){
					var j = A.cols[ka]; 
					while ( B.cols[kb] < j && kb < eb)
						kb++;
					if(B.cols[kb] == j) {
						val.push(A.val[ka] * B.val[kb]);	
						cols.push(j);
						rows[i+1]++;
					}
					ka++;
				}
			}
			for(i=1; i < A.m; i++)
				rows[i+1] += rows[i];
				
			return new spMatrix(A.m, A.n, val, cols, rows);
		}
		else {
			return entrywisemulspMatrixMatrix(B, fullMatrix(A)); // perhaps not the fastest
		}
	}
	else {
		if ( B.rowmajor ) {
			return entrywisemulspMatrixMatrix(A, fullMatrix(B)); // perhaps not the fastest
		}
		else {
			var val = new Array();
			var cols = new Uint32Array(A.n+1);
			var rows = new Array();
			var ka;
			var kb;	
			var j;
			for ( j=0; j < A.n; j++) {
				ka = A.cols[j];
				kb = B.cols[j];
				var ea = A.cols[j+1];
				var eb = B.cols[j+1];
				while ( ka < ea & kb < eb ){
					var i = A.rows[ka]; 
					while ( B.rows[kb] < i && kb < eb)
						kb++;
					if(B.rows[kb] == i) {
						val.push(A.val[ka] * B.val[kb]);	
						rows.push(i);
						cols[j+1]++;
					}
					ka++;
				}
			}
			for ( j=1; j< A.n; j++) 
				cols[j+1] += cols[j];
	
			return new spMatrix(A.m, A.n, val, cols, rows);
		}
	}
}
/**
 * @param{spMatrix}
 * @param{Matrix}
 * @return{spMatrix}
 */
function entrywisemulspMatrixMatrix (A, B) {
	var c = A.copy();	
	const nnz = A.val.length;
	const n = A.n;
	const m = A.m;
	if ( A.rowmajor ) {
		for ( i=0;i< m; i++) {
			var s = c.rows[i];
			var e = c.rows[i+1];
			var r = i*n;
			for ( var k = s; k< e; k++) {
				c.val[k] *= B.val[r + c.cols[k] ];
			}
		}
	}
	else {
		for ( j=0;j< n; j++) {
			var s = c.cols[j];
			var e = c.cols[j+1];
			for ( var k = s; k< e; k++) {
				c.val[k] *= B.val[c.rows[k] * n + j];
			}
		}
	}
	return c;
}

/**
 * @param{number}
 * @param{spVector}
 * @return{Float64Array}
 */
function addScalarspVector (a, b) {
	const nnzb = b.val.length;
	const n = b.length;
	var c = zeros(n);
	var k;
	for ( k=0;k < n; k++) 
		c[k] = a;
	for ( k=0;k < nnzb; k++) 
		c[b.ind[k]] += b.val[k];
			
	return c;
}
/**
 * @param{Float64Array}
 * @param{spVector}
 * @return{Float64Array}
 */
function addVectorspVector (a, b) {
	const nnzb = b.val.length;
	const n = b.length;
	var c = new Float64Array(a);
	for (var k=0;k < nnzb; k++) 
		c[b.ind[k]] += b.val[k];
			
	return c;
}
/**
 * @param{spVector}
 * @param{spVector}
 * @return{spVector}
 */
function addspVectors (a, b) {
	const nnza = a.val.length;
	const nnzb = b.val.length;
	var c = zeros(a.length);
	var k;
	for ( k=0;k < nnza; k++) 
		c[a.ind[k]] = a.val[k];
	for ( k=0;k < nnzb; k++) 
		c[b.ind[k]] += b.val[k];
			
	return sparseVector(c);
}

/**
 * @param{number}
 * @param{spMatrix}
 * @return{Matrix}
 */
function addScalarspMatrix (a, B) {
	const nnzb = B.val.length;
	const m = B.m;
	const n = B.n;
	const mn = m*n;
	
	var C = zeros(m,n); 
	var i;
	for (i = 0; i < mn; i++)
		C.val[i] = a;
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] += B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] += B.val[k];
		}
	}
	return C;
}
/**
 * @param{Matrix}
 * @param{spMatrix}
 * @return{Matrix}
 */
function addMatrixspMatrix (A, B) {
	const nnzb = B.val.length;
	const m = B.m;
	const n = B.n;
	const mn = m*n;
	
	var C = matrixCopy(A);
	var i;	
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] += B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] += B.val[k];
		}
	}
	return C;
}
/**
 * @param{spMatrix}
 * @param{spMatrix}
 * @return{spMatrix}
 */
function addspMatrices (A, B) {
	const nnza = A.val.length;
	const nnzb = B.val.length;
	const m = A.m;
	const n = A.n;
	
	var C = fullMatrix(A); 
	var i;	
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] += B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] += B.val[k];
		}
	}
	return sparseMatrixRowMajor(C);
}

/** sparse SAXPY : y = y + ax with x sparse and y dense
 * @param {number}
 * @param {spVector}
 * @param {Float64Array}
 */
function spsaxpy ( a, x, y) {
	const nnz = x.val.length;	
	for (var k=0;k < nnz; k++) 
		y[x.ind[k]] += a * x.val[k];			
}

/**
 * @param{number}
 * @param{spVector}
 * @return{Float64Array}
 */
function subScalarspVector (a, b) {
	const nnzb = b.val.length;
	const n = b.length;
	var c = zeros(n);
	var k;
	for ( k=0;k < n; k++) 
		c[k] = a;
	for ( k=0;k < nnzb; k++) 
		c[b.ind[k]] -= b.val[k];
			
	return c;
}
/**
 * @param{Float64Array}
 * @param{spVector}
 * @return{Float64Array}
 */
function subVectorspVector (a, b) {
	const nnzb = b.val.length;
	const n = b.length;
	var c = new Float64Array(a);
	for (var k=0;k < nnzb; k++) 
		c[b.ind[k]] -= b.val[k];
			
	return c;
}
/**
 * @param{spVector}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function subspVectorVector (a, b) {
	return subVectors(fullVector(a), b);
}
/**
 * @param{spVector}
 * @param{spVector}
 * @return{spVector}
 */
function subspVectors (a, b) {
	const nnza = a.val.length;
	const nnzb = b.val.length;
	var c = zeros(a.length);
	var k;
	for ( k=0;k < nnza; k++) 
		c[a.ind[k]] = a.val[k];
	for ( k=0;k < nnzb; k++) 
		c[b.ind[k]] -= b.val[k];
			
	return sparseVector(c);
}

/**
 * @param{number}
 * @param{spMatrix}
 * @return{Matrix}
 */
function subScalarspMatrix (a, B) {
	const nnzb = B.val.length;
	const m = B.m;
	const n = B.n;
	const mn = m*n;
	
	var C = zeros(m,n); 
	var i;
	for (i = 0; i < mn; i++)
		C.val[i] = a;
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] -= B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] -= B.val[k];
		}
	}
	return C;
}
/**
 * @param{spMatrix}
 * @param{Matrix}
 * @return{Matrix}
 */
function subspMatrixMatrix (A, B) {
	return subMatrices(fullMatrix(A), B);
}
/**
 * @param{Matrix}
 * @param{spMatrix}
 * @return{Matrix}
 */
function subMatrixspMatrix (A, B) {
	const nnzb = B.val.length;
	const m = B.m;
	const n = B.n;
	const mn = m*n;
	
	var C = matrixCopy(A);
	var i;	
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] -= B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] -= B.val[k];
		}
	}
	return C;
}
/**
 * @param{spMatrix}
 * @param{spMatrix}
 * @return{spMatrix}
 */
function subspMatrices (A, B) {
	const nnza = A.val.length;
	const nnzb = B.val.length;
	const m = A.m;
	const n = A.n;
	
	var C = fullMatrix(A); 
	var i;	
	if ( B.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = B.rows[i];
			var e = B.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + B.cols[k]] -= B.val[k];
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = B.cols[i];
			var e = B.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[B.rows[k] * n + i] -= B.val[k];
		}
	}
	return sparseMatrixRowMajor(C);
}

/**
 * @param{function}
 * @param{spVector}
 * @return{Float64Array}
 */
function applyspVector( f, x ) {
	const nnz = x.val.length;
	const n = x.length;
	var res = new Float64Array(n);
	var i;
	const f0 = f(0);
	for ( i=0; i< n; i++) 
		res[i] = f0;
	for ( i=0; i< nnz; i++) 
		res[x.ind[i]] = f(x.val[i]);
	return res;
}
/**
 * @param{function}
 * @param{spMatrix}
 * @return{Matrix}
 */
function applyspMatrix( f, X ) {
	const nnz = X.val.length;
	const m = X.m;
	const n = X.n;
	const mn = m*n;
	const f0 = f(0);
	var C = zeros(m,n); 
	var i;
	if ( !isZero(f0) ) {
		for (i = 0; i < mn; i++)
			C.val[i] = f0;
	}
	if ( X.rowmajor ) {
		var ri = 0;
		for (i = 0; i < m; i++) {
			var s = X.rows[i];
			var e = X.rows[i+1];
			for (var k= s; k < e; k++)
				C.val[ri + X.cols[k]] = f(X.val[k]);
			ri += n;
		}
	}
	else {
		for (i = 0; i < n; i++) {
			var s = X.cols[i];
			var e = X.cols[i+1];
			for (var k= s; k < e; k++)
				C.val[X.rows[k] * n + i] += f(X.val[k]);
		}
	}
	return C;
}
/**
 * @param{spVector}
 * @return{number}
 */
function sumspVector( a ) {
	return sumVector(a.val);
}
/**
 * @param{spMatrix}
 * @return{number}
 */
function sumspMatrix( A ) {
	return sumVector(A.val);
}
/**
 * @param{spMatrix}
 * @return{Matrix}
 */
function sumspMatrixRows( A ) {
	var res = zeros(A.n);
	if ( A.rowmajor ) {
		for ( var k=0; k < A.val.length; k++)
			res[A.cols[k]] += A.val[k];
	}
	else {
		for ( var i=0; i<A.n; i++)
			res[i] = sumspVector(A.col(i));
	}
	return new Matrix(1,A.n, res, true);
}
/**
 * @param{spMatrix}
 * @return{Float64Array}
 */
function sumspMatrixCols( A ) {	
	var res = zeros(A.m);
	if ( A.rowmajor ) {
		for ( var i=0; i<A.m; i++)
			res[i] = sumspVector(A.row(i));			
	}
	else {
		for ( var k=0; k < A.val.length; k++)
			res[A.rows[k]] += A.val[k];
	}
	return res;
}
/**
 * @param{spMatrix}
 * @return{Matrix}
 */
function prodspMatrixRows( A ) {
	if ( A.rowmajor ) {
		var res = ones(A.n);	
		for ( var i=0; i < A.m; i++) {
			var s = A.rows[i];
			var e = A.rows[i+1];
			for ( var j=0; j < A.n; j++) 
				if ( A.cols.subarray(s,e).indexOf(j) < 0 )
					res[j] = 0;
			for ( var k=s; k < e; k++)
				res[A.cols[k]] *= A.val[k];
		}
	}
	else {
		var res = zeros(A.n);
		for ( var i=0; i<A.n; i++) {
			var a = A.col(i);
			if ( a.val.length == a.length )
				res[i] = prodVector(a.val);
		}
	}
	return new Matrix(1,A.n, res, true);
}
/**
 * @param{spMatrix}
 * @return{Float64Array}
 */
function prodspMatrixCols( A ) {	
	if ( A.rowmajor ) {
		var res = zeros(A.m);
		for ( var i=0; i<A.m; i++) {
			var a = A.row(i);
			if ( a.val.length == a.length )
				res[i] = prodVector(a.val);
		}
	}
	else {
		var res = ones(A.m);	
		for ( var j=0; j < A.n; j++) {
			var s = A.cols[j];
			var e = A.cols[j+1];
			for ( var i=0; i < A.m; i++) 
				if ( A.rows.subarray(s,e).indexOf(i) < 0 )
					res[i] = 0;
			for ( var k=s; k < e; k++)
				res[A.rows[k]] *= A.val[k];
		}
	}
	return res;
}


///////////////////////////
/// Sparse linear systems 
///////////////////////////
/** Sparse Conjugate gradient method for solving the symmetric positie definite system Ax = b
 * @param{spMatrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function spsolvecg ( A, b) {

	const n = A.n;	
	const m = A.m;

	var x = randn(n); 
	var r = subVectors(b, mulspMatrixVector(A, x));
	var rhoc = dot(r,r);
	const TOL = 1e-8;
	var delta2 = TOL * norm(b);
	delta2 *= delta2;
	
	// first iteration:
	var p = vectorCopy(r);
	var w = mulspMatrixVector(A,p);
	var mu = rhoc / dot(p, w);
	saxpy( mu, p, x);
	saxpy( -mu, w, r);
	var rho_ = rhoc;
	rhoc = dot(r,r);

	var k = 1;

	var updateP = function (tau, r) {
		for ( var i=0; i < m; i++)
			p[i] = r[i] + tau * p[i];
	}
	
	while ( rhoc > delta2 && k < n ) {
		updateP(rhoc/rho_, r);
		w = mulspMatrixVector(A,p);
		mu = rhoc / dot(p, w);
		saxpy( mu, p, x);
		saxpy( -mu, w, r);
		rho_ = rhoc;
		rhoc = dot(r,r);
		k++;
	}
	return x;
}
/** Sparse Conjugate gradient normal equation residual method for solving the rectangular system Ax = b
 * @param{spMatrix}
 * @param{Float64Array}
 * @return{Float64Array}
 */
function spcgnr ( A, b) {
/*
TEST
A = randnsparse(0.3,10000,1000)
x = randn(1000)
b = A*x + 0.01*randn(10000)
tic()
xx = cgnr(A,b)
t1 = toc()
ee = norm(A*xx - b)
tic()
xh=spcgnr(sparse(A), b)
t2 = toc()
e = norm(A*xh - b)
*/
	
	const n = A.n;	
	const m = A.m;

	var x = randn(n); 
	var r = subVectors(b, mulspMatrixVector(A, x));	
	const TOL = 1e-8;
	var delta2 = TOL * norm(b);
	delta2 *= delta2;
	
	// first iteration:
	var z = mulspMatrixTransVector(A, r);
	var rhoc = dot(z,z);	
	var p = vectorCopy(z);
	var w = mulspMatrixVector(A,p);
	var mu = rhoc / dot(w, w);
	saxpy( mu, p, x);
	saxpy( -mu, w, r);	
	z = mulspMatrixTransVector(A, r);
	var rho_ = rhoc;
	rhoc = dot(z,z);

	var k = 1;

	var updateP = function (tau, z) {
		for ( var i=0; i < m; i++)
			p[i] = z[i] + tau * p[i];
	}
	
	while ( rhoc > delta2 && k < n ) {
		updateP(rhoc/rho_, z);
		w = mulspMatrixVector(A,p);
		mu = rhoc / dot(w, w);
		saxpy( mu, p, x);
		saxpy( -mu, w, r);
		z = mulspMatrixTransVector(A, r);
		rho_ = rhoc;
		rhoc = dot(z,z);
		k++;
	}
	return x;
}


/* glpk.js is now included (cat) in lalolib.js
if ( self.hasOwnProperty("window") ) {
	// in main window 
}
else { 
	// in worker
	importScripts("glpk.js");
	//importScripts("glpk.min.js");
}*/

// Install glpk as lp function: 
if ( typeof(lp) == "undefined" ) {
	lp = glp;
	linprog = glp;
}

function glp (c, A, b, Aeq, beq, lb , ub, integer_variables, verbose) {
/*
	Call GLPK to solve 
	min c' x s.t. Ax<= b, Aeq = beq, lb<= x <= ub, x[integer_variables] in Z
*/

/* TESTS:
Aineq = [[1, 1]; [-1,1]]
Bineq = [2; 1]
costineq = [-1; -2]
lb = [0;0]
xsol = glp(costineq, Aineq, Bineq, [], [], lb)

A = [[3,2,1,1,0],[2,5,3,0,1]]
b=[10,15]
c=[-2,-3,-4,0,0]
lb = zeros(5)
xsol = glp(c, [],[],A, b,lb,[])

*/
	var prob = glp_create_prob();
	glp_set_obj_dir ( prob, GLP_MIN ) ;
	
	if ( typeof(Aeq) == "undefined" )
		var Aeq = [];
	
	glp_add_cols(prob, c.length);
	if ( A.length + Aeq.length > 0 )
		glp_add_rows(prob, A.length + Aeq.length);

	var i;
	var j;
	var indexes ;
	var values;
	var n = c.length;
	
	if ( lb ) {
		var lbdense = vectorCopy(lb);
		for ( i=0; i < lbdense.length; i++){
			if ( !isFinite( lbdense[i] ) )
				lbdense[i] = NaN;
		}
	}
	else 
		var lbdense = [];

	if ( ub ) {
		var ubdense = vectorCopy(ub);
		for ( i=0; i < ubdense.length; i++){
			if ( !isFinite( ubdense[i] ) )
				lbdense[i] = NaN;
		}
	}
	else 
		var ubdense = [];
	
	for ( i=0; i < c.length; i++) {
		// variable bounds
		var lbi = NaN;
		var ubi = NaN; 
		if ( lbdense.length > 0)	
			lbi = lbdense[i];
		if ( ubdense.length > 0 )
			ubi = ubdense[i] ;
			
		if ( !isNaN(lbi)  && !isNaN(ubi)) 
			glp_set_col_bnds( prob, i+1, GLP_DB, lbi , ubi );
		else if ( !isNaN(lbi) )
			glp_set_col_bnds( prob, i+1, GLP_LO, lbi );
		else if ( !isNaN(ubi) )
			glp_set_col_bnds( prob, i+1, GLP_UP, 0, ubi );
		else 
			glp_set_col_bnds( prob, i+1, GLP_FR );
			
		// cost
		glp_set_obj_coef ( prob, i+1, c[i]  );
		
	}	
	
	// Integer variables
	if ( integer_variables ) {
		for ( i=0; i< integer_variables.length ; i++) 
			glp_set_col_kind(prob, integer_variables[i]+1, GLP_IV );
	}
	
	// inequalities
	if ( A.length == 1 && typeof(b) == "number")
		b = [b];
	for ( i=0; i<A.length; i++) {
		
		// RHS		
		glp_set_row_bnds(prob, i+1, GLP_UP, 0, b[i] );	// pass lb=0 otherwise ub undefined!!
		
		// LHS
		indexes = new Array(); 	
		values = new Array(); 	
		indexes.push(0);	// to make it start at 1
		values.push(0); 	
		for ( j = 0; j < n; j++ ) {
			if ( !isZero(A.val[i*n+j] )) {
				indexes.push(j+1);
				values.push( A.val[i*n+j] );
			}
		}
		glp_set_mat_row( prob, i+1, indexes.length -1, indexes, values) ;
		
	}

	// equality constraints	
	if ( Aeq.length == 1 && typeof(beq) == "number")
		beq = [beq];
	for ( i=0; i<Aeq.length; i++) {
		
		// RHS		
		glp_set_row_bnds(prob, A.length+i+1, GLP_FX, beq[i] );
				
		// LHS
		indexes = new Array(); 
		values = new Array(); 		
		indexes.push(0);	// to make it start at 1
		values.push(0); 	
		for ( j = 0; j < n; j++ ) {
			if (  !isZero(Aeq.val[i*n+j] )) {
				indexes.push(j+1);
				values.push( Aeq.val[i*n+j] );
			}
		}
		glp_set_mat_row( prob,A.length+ i+1, indexes.length -1, indexes, values) ;
	}

	//glp_write_lp(prob, undefined, function (str) {console.log(str);});

	var rc;
	if ( integer_variables && integer_variables.length > 0) {
		// Solve with MILP solver
		var iocp = new IOCP({presolve: GLP_ON});
		glp_scale_prob(prob, GLP_SF_AUTO);
		rc = glp_intopt(prob, iocp);
		
		// get solution
		if ( rc == 0 ) {
			var sol = zeros(n);
			for ( i=0; i<n; i++) {
				sol[i] = glp_mip_col_val( prob, i+1);
			}
			
			if ( verbose) {
				var obj = glp_mip_obj_val(prob);
				console.log("Status : " + glp_mip_status(prob) );
				console.log("Obj : " + obj);
			}
			return sol;
		}
		else
			return "Status : " + glp_get_prim_stat(prob);
	}
	else {
		// Parameters
		var smcp = new SMCP({presolve: GLP_ON});
		// Solve with Simplex
		glp_scale_prob(prob, GLP_SF_AUTO);
		rc = glp_simplex(prob, smcp);
		
		// get solution
		if ( rc == 0 ) {
			var sol = zeros(n);
			for ( i=0; i<n; i++) {
				sol[i] = glp_get_col_prim( prob, i+1);
			}
			if ( verbose) {
				var obj = glp_get_obj_val(prob);
				console.log("Status : " + glp_get_status(prob) + "(OPT=" + GLP_OPT + ",FEAS=" + GLP_FEAS + ",INFEAS=" + GLP_INFEAS + ",NOFEAS=" + GLP_NOFEAS + ",UNBND=" + GLP_UNBND + ",UNDEF=" + GLP_UNDEF + ")" );
				console.log("Obj : " + obj);
			}
			return sol;
		}
		else {
			GLPLASTLP = "";
			glp_write_lp(prob, undefined, function (str) {GLPLASTLP += str + "<br>";});
			return "RC=" + rc + " ; Status : "  + glp_get_status(prob) + "(OPT=" + GLP_OPT + ",FEAS=" + GLP_FEAS + ",INFEAS=" + GLP_INFEAS + ",NOFEAS=" + GLP_NOFEAS + ",UNBND=" + GLP_UNBND + ",UNDEF=" + GLP_UNDEF + ")" ;
		}
	}
	
}

///////////////////////////////:
/////// L1-minimization and sparse recovery //////////
///////////
function minl1 ( A, b) {
	/*
		Solves min ||x||_1 s.t. Ax = b
		
		as 
		
			min sum a_i s.t. -a <= x <= a and Ax = b
			
		example: 
A = randn(10,20)
r = zeros(20)
r[0:3] = randn(3)
x=minl1(A,A*r)

	*/
	const n = A.n;
	
	var Aineq = zeros ( 2*n, 2*n ) ;
	var i;
	
	//set ( Aineq, range(0,n),range(0,n) , I) ;
	//set ( Aineq, range(0,n),range(n,2*n) , I_) ;
	//set ( Aineq, range(n,2*n),range(0,n) , I_) ;
	//set ( Aineq, range(n,2*n),range(n,2*n) , I_) ;
	for ( i=0; i < n; i++) {
		Aineq.val[i*Aineq.n + i] = 1;
		Aineq.val[i*Aineq.n + n+i] = -1;
		Aineq.val[(n+i)*Aineq.n + i] = -1;
		Aineq.val[(n+i)*Aineq.n + n+i] = -1;
	}
	var bineq = zeros ( 2*n);
	
	var Aeq = zeros(A.length, 2*n);
	set ( Aeq , [], range( 0,n), A );
	
	var cost = zeros(2*n);
	set ( cost, range(n,2*n),  ones(n) );
		
	var lb = zeros(2*n);	// better to constraint a>=0
	set ( lb, range(n), mulScalarVector(-Infinity , ones( n )) ) ;	
//console.log( cost, Aineq, bineq, Aeq, b, lb);	
//	var lpsol = lp( cost, Aineq, bineq, Aeq, b, lb, [], 0 , 1e-6 );
	var lpsol = glp( cost, Aineq, bineq, Aeq, b, lb);	

	return get(lpsol, range(n) );
}



function minl0 ( A, b, M) {
	/*
		Solves min ||x||_0 s.t. Ax = b  -M <= x <= M
		
		as a mixed integer linear program
		
			min sum a_i s.t. -M a <= x <= M a , Ax = b and a_i in {0,1}
			
		example: 
A = randn(10,20)
r = zeros(20)
r[0:3] = randn(3)
x=minl0(A,A*r)

	*/
	
	if ( typeof(M) == "undefined" ) 
		var M = 10;
		
	var n = A.n;
	
	var Aineq = zeros ( 2*n, 2*n ) ;
	//set ( Aineq, range(0,n),range(0,n) , I) ;
	//set ( Aineq, range(0,n),range(n,2*n) , mul(M, I_) ) ;
	//set ( Aineq, range(n,2*n),range(0,n) , I_) ;
	//set ( Aineq, range(n,2*n),range(n,2*n) ,mul(M, I_) ) ;
	var i;
	for ( i=0; i < n; i++) {
		Aineq.val[i*Aineq.n + i] = 1;
		Aineq.val[i*Aineq.n + n+i] = -M;
		Aineq.val[(n+i)*Aineq.n + i] = -1;
		Aineq.val[(n+i)*Aineq.n + n+i] = -M;

	}
	var bineq = zeros ( 2*n);
	
	var Aeq = zeros(A.length, 2*n);
	set ( Aeq , [], range( 0,n), A );
	
	var cost = zeros(2*n);
	set ( cost, range(n,2*n),  ones(n) );
		
	var lb = zeros(2*n);	// better to constraint a>=0
	set ( lb, range(n), mulScalarVector(-M , ones( n )) ) ;	

	var ub =  ones(2*n) ;
	set(ub, range(n), mulScalarVector(M, ones(n) ) );
	
	var lpsol = glp( cost, Aineq, bineq, Aeq, b, lb, ub, range(n,2*n) );	// glptweak??

	// set to 0 the x corresponding to 0 binary variables:
	var x = entrywisemulVector( getSubVector(lpsol, range(n) ), getSubVector(lpsol, range(n,2*n) ) );

	return x;
}


///////////////////////////////////////////
/// Quadratic Programming 
////////////////
quadprog = qp;

function qp(Q,c,A,b,Aeq,beq,lb,ub,x0, epsilon) {
	// Solve quad prog by Frank-Wolfe algorithm
	/*
		min 0.5 x' * Q * x  c' * x
		s.t. Ax <= b   and   lu <= x <= ub
		
		NOTE: all variables should be bounded or constrained,
		otherwise the LP might be unbounded even if the QP is well-posed
	*/
	if (typeof(epsilon) === 'undefined')
		var epsilon = 1e-3;
		
	var normdiff;
	var normgrad;
	var grad;
	var y;
	var gamma;
	var direction;
	
	var x;
	if ( typeof(x0) === 'undefined' ) {		
		//console.log ("providing an initial x0 might be better for qp.");		
		x = glp(zeros(c.length),A, b, Aeq, beq, lb, ub, [], false) ;  
		if ( typeof(x) == "string")
			return "infeasible";
	}
	else {
		x = vectorCopy(x0);
	}

	var iter = 0;
	do {

		// Compute gradient : grad = Qx + c
		grad = add( mul( Q, x) , c );
		normgrad = norm(grad);

		// Find direction of desecnt : direction = argmin_y   y'*grad s.t. same constraints as QP
		y = glp(grad, A, b, Aeq, beq, lb, ub, [], false) ; 
/*		if ( typeof(y) == "string") 
			return x; // error return current solution;
	*/

		// Step size: gamma = -(y - x)' [ Qx + c] / (y-x)'Q(y-x) = numerator / denominator
		direction = sub (y, x);
		
		numerator = - mul(direction, grad);
		
		denominator = mul(direction, mul(Q, direction) ); 

		if ( Math.abs(denominator) > 1e-8 && denominator > 0)
			gamma = numerator / denominator; 
		else 
			gamma = 0;
			
		if ( gamma > 1 ) 
			gamma = 1;

		// Update x <- x + gamma * direction
		if ( gamma > 0 ) {
			x = add(x, mul(gamma, direction) );		
			normdiff = gamma * norm(direction) ;
		}
		else 
			normdiff = 0;

		iter++;
	} while ( normdiff > epsilon && normgrad > epsilon && iter < 10000) ;

	return x;
}



/////////////////////////////////////////:
//// Unconstrained Minimization
/////////////////////////////////////////
function minimize( f, grad, x0 ) {
/*
function loss(x) {
return (norm(b - A*x)^2)
}
function grad(x) {
return (2*A'*A*x - 2*A'*b)
}
x = randn(10)
A = randn(100,10)
b = A*x + 0.01*randn(100)
xh = minimize(A.n, loss, grad)
norm(x - xh)
*/
	var x;
	var n = 1; // dimension of x
	
	if ( arguments.length == 3 ) {
		if ( typeof(x0) == "number" ) {
			if( x0 > 0 && Math.floor(x0) == x0 ) {
				n = x0;
				x = sub(mul(20,rand(n)), 10); 
			}
			else {
				n = 1;
				x = x0; 
			}
		}
		else {
			n = x0.length;
			x = x0;
		}
	}
	else {		
		n = 1;
		x = 20 * Math.random() - 10; 
	}
	
	if ( n == 1 )
		return secant(f, grad, x);
	else if ( n > 500 ) 
		return steepestdescent(f, grad, x);
	else
		return bfgs(f, grad, x);
}

function secant( f, grad, x0 ) {
	// for a unidimensional function f
	// find a root to f'(x) = 0 with the secant method
	const TOLx = 1e-6;
	
	var x = x0; 
	var g = grad(x);
	var dx = -0.01*g;
	x += dx;
	var gprev,dg;
	do {
		gprev = g;
		g = grad(x);
		dg = g-gprev;

		dx *= -g / dg;
		x += dx;

	} while ( Math.abs(dx) > TOLx);
	return x;
}


function steepestdescent(f, grad, x0) {
	// assume x is a vector
	
	const TOLobj = 1e-8;
	const TOLx = 1e-6;
	const TOLgrad = 1e-4;

	var x = x0;
	var xprev;
	var obj = f(x);
	var g = grad(x);
	var normg = norm(g);
	var iter = 0;
	do {
		
		// line search
		var linesearch = armijo(f, x, obj, g, normg);		
		
		// take the step
		xprev = vectorCopy(x);
		prevobj = obj;		
		x = linesearch.x;
		obj = linesearch.obj;
		g = grad(x);
		normg = norm(g);
		
		iter++;
		//console.log(linesearch.lambda, x, obj, g);
	} while ( normg > TOLgrad && prevobj - obj > TOLobj && norm(subVectors(x, xprev) ) > TOLx ) ;
	console.log(" OBJ: " + obj + ", norm(grad): " + normg, "prevobj - obj", prevobj - obj, "iter: ", iter );
	return x;
}

function bfgs( f, grad, x0 ) {
	// assume x is a vector
	
	const n = x0.length;
	const TOLobj = 1e-8;
	const TOLx = 1e-6;
	const TOLgrad = 1e-4;

	var x = x0;
	var xprev;
	var obj = f(x);
	var H = eye(n);
	var g,direction, delta, gamma, ls;
	var normg;
	var Hgamma;
	var dH;
	var iter = 0;
	do {
		g = grad(x);
		normg = norm(g);
		direction = minusVector( mulMatrixVector(H, g ) );
		
		// line search
		var linesearch = armijodir (f, x, obj, g, direction ); 

		// take the step
		xprev = vectorCopy(x);
		prevobj = obj;		
		x = linesearch.x;
		obj = linesearch.obj;

		// update Hessian inverse approximation
		delta = subVectors(x,xprev);
		gamma = subVectors(grad(x) , g);
		
		Hgamma = mulMatrixVector(H, gamma);
		
		var deltagamma = dot(delta,gamma);
		var delta_ = mulScalarVector(1/deltagamma, delta);

		var deltagammaH = outerprodVectors(delta_, Hgamma);
		
		dH = subMatrices(outerprodVectors(delta_, delta, 1+ dot(gamma, Hgamma)/deltagamma) , addMatrices(deltagammaH, transposeMatrix(deltagammaH) ) );
		//--		
		
		H = add(H, dH); 	
		
		iter++;
			
	} while ( normg > TOLgrad && prevobj - obj > TOLobj && norm(subVectors(x, xprev) ) > TOLx ) ;
	console.log(" OBJ: " + obj + ", norm(grad): " + normg, "prevobj - obj", prevobj - obj, "iters: ", iter );
	return x;
}


/**
 * Return minimizer of p(x) = p0 + p1 x + p2 x^2 + p3 x^3 with p(x1) = px1, p(x2) = px2
 * within [lb, ub]
 *
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @return {number}  
 */ 
function mincubic(p0, p1, x1, px1, x2, px2, lb, ub) {

	const x1square = x1*x1;
	const x2square = x2*x2;
	
	var A = new Matrix(2,2, [x1square, x1*x1square, x2square, x2*x2square]);
	var b = new Float64Array([px1 - p0 - p1*x1, px2 - p0 - p1*x2]);
    var c = solve(A,b);
    var x = (-c[0] + Math.sqrt(c[0]*c[0] - 3 *c[1] * p1))/(3*c[1]);
  
    return Math.min(ub, Math.max(lb, x));
}
/**
 * Return minimizer of p(x) = p0 + p1 x + p2 x^2 with p(x1) = px1 (x1 ~ 1)
 * within [lb, ub]
 *
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @param {number}
 * @return {number}  
 */
function minquadratic(p0, p1, px1, x1, lb, ub) {	
    var x = - p1/(2 * x1 * (px1 - p0 - p1) );
    return Math.min(ub, Math.max(lb, x));
}

/**
 * Armijo line search with objective function f
 * and starting point xc, fc, g
 *
 * @param {function}
 * @param {{Float64Array|number}}
 * @param {number}
 * @param {{Float64Array|number}}
 * @param {number}
 * @return {{Float64Array|number}}  
 */
function armijo (f, xc, fc, g, normg ) {
	// Armijo's rule line search in the direction of gradient g
	const alpha = 0.0001;
	const blow = 0.1;
	const bhigh = 0.5;
	const normg2 = normg * normg;
	
	var lambda = Math.min(1,100/(1+normg)); 
	var fgoal = fc - alpha * lambda * normg2;
	
    var lambda1 = lambda;
    var xt = subVectors(xc, mulScalarVector(lambda, g) );
    var ft_1 = fc;
    var ft = f(xt);

    var iter = 1;

	// first iter
    lambda = minquadratic(fc, -normg2, lambda1, ft, blow*lambda1, bhigh*lambda1);
	var ft_1 = ft;
	var lambda2 = lambda1;
	lambda1 = lambda;
		
    iter++;
    // next iterations
	while(ft > fgoal && iter <= 10) {
		            
		lambda = mincubic(fc, -normg2, lambda1, ft, lambda2, ft_1, blow*lambda1, bhigh*lambda1);
		lambda2 = lambda1;
		lambda1 = lambda;
		
		xt = subVectors(xc, mulScalarVector(lambda, g) );
		ft_1 = ft;
		ft = f(xt);
		
		fgoal = fc - alpha * lambda * normg2;
                
		iter++;
	}
	return {"lambda": lambda, "x": xt, "obj": ft};
}
function armijodir (f, xc, fc, g, d ) {
	// Armijo's rule line search in the direction d
	const alpha = 0.0001;
	const blow = 0.1;
	const bhigh = 0.5;
	const p1 = dot( g, d);
	
	var lambda = Math.min(1,100/(1+norm(g))); 
	var fgoal = fc + alpha * lambda * p1;
	
    var lambda1 = lambda;
    var xt = addVectors(xc, mulScalarVector(lambda, d) );
    var ft_1 = fc;
    var ft = f(xt);

    var iter = 1;

	// first iter
    lambda = minquadratic(fc, p1, lambda1, ft, blow*lambda1, bhigh*lambda1);
	var ft_1 = ft;
	var lambda2 = lambda1;
	lambda1 = lambda;
		
    iter++;
    // next iterations
	while(ft > fgoal && iter <= 10) {
		            
		lambda=mincubic(fc, p1, lambda1, ft, lambda2, ft_1, blow*lambda1, bhigh*lambda1 );
		lambda2 = lambda1;
		lambda1 = lambda;
		
		xt = addVectors(xc, mulScalarVector(lambda, d) );
		ft_1 = ft;
		ft = f(xt);
		
		fgoal = fc + alpha * lambda * p1;
                
		iter++;
	}
	return {"lambda": lambda, "x": xt, "obj": ft};
}

/*! glpk.js - v4.49.0
* https://github.com/hgourvest/glpk.js
* Copyright (c) 2013 Henri Gourvest; Licensed GPLv2 */
(function(exports) {
var t=Number.MAX_VALUE,fa=Number.MIN_VALUE;function x(a){throw Error(a);}function y(){}exports.glp_get_print_func=function(){return y};exports.glp_set_print_func=function(a){y=a};function ga(a,b){for(var c in b)a[c]=b[c]}function ha(a,b,c,d,e){for(;0<e;b++,d++,e--)a[b]=c[d]}function ja(a,b,c,d){for(;0<d;b++,d--)a[b]=c}function ka(a,b,c){for(;0<c;b++,c--)a[b]={}}function la(){return(new Date).getTime()}function ma(a){return(la()-a)/1E3}
function na(a,b,c){var d=Array(b);ha(d,0,a,1,b);d.sort(c);ha(a,1,d,0,b)}var pa={},sa=exports.glp_version=function(){return qa+"."+ra};function ta(a){a="string"==typeof a?a.charCodeAt(0):-1;return 0<=a&&31>=a||127==a}function ua(a){a="string"==typeof a?a.charCodeAt(0):-1;return 65<=a&&90>=a||97<=a&&122>=a}function va(a){a="string"==typeof a?a.charCodeAt(0):-1;return 65<=a&&90>=a||97<=a&&122>=a||48<=a&&57>=a}function wa(a){a="string"==typeof a?a.charCodeAt(0):-1;return 48<=a&&57>=a}
function xa(){function a(a,d,e,h,l,n,m){a=a>>>0;e=e&&a&&{2:"0b",8:"0",16:"0x"}[d]||"";a=e+c(a.toString(d),n||0,"0",!1);return b(a,e,h,l,m)}function b(a,b,d,e,l,n){var m=e-a.length;0<m&&(a=d||!l?c(a,e,n,d):a.slice(0,b.length)+c("",m,"0",!0)+a.slice(b.length));return a}function c(a,b,c,d){c||(c=" ");b=a.length>=b?"":Array(1+b-a.length>>>0).join(c);return d?a+b:b+a}var d=arguments,e=0;return d[e++].replace(/%%|%(\d+\$)?([-+\'#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuideEfFgG])/g,function(f,
g,k,h,l,n,m){var q,r;if("%%"==f)return"%";var p=!1;r="";var u=l=!1;q=" ";for(var v=k.length,H=0;k&&H<v;H++)switch(k.charAt(H)){case " ":r=" ";break;case "+":r="+";break;case "-":p=!0;break;case "'":q=k.charAt(H+1);break;case "0":l=!0;break;case "#":u=!0}h=h?"*"==h?+d[e++]:"*"==h.charAt(0)?+d[h.slice(1,-1)]:+h:0;0>h&&(h=-h,p=!0);if(!isFinite(h))throw Error("sprintf: (minimum-)width must be finite");n?n="*"==n?+d[e++]:"*"==n.charAt(0)?+d[n.slice(1,-1)]:+n:n=-1<"fFeE".indexOf(m)?6:"d"==m?0:void 0;g=
g?d[g.slice(0,-1)]:d[e++];switch(m){case "s":return m=String(g),null!=n&&(m=m.slice(0,n)),b(m,"",p,h,l,q);case "c":return m=String.fromCharCode(+g),null!=n&&(m=m.slice(0,n)),b(m,"",p,h,l,void 0);case "b":return a(g,2,u,p,h,n,l);case "o":return a(g,8,u,p,h,n,l);case "x":return a(g,16,u,p,h,n,l);case "X":return a(g,16,u,p,h,n,l).toUpperCase();case "u":return a(g,10,u,p,h,n,l);case "i":case "d":return q=+g||0,q=Math.round(q-q%1),f=0>q?"-":r,g=f+c(String(Math.abs(q)),n,"0",!1),b(g,f,p,h,l);case "e":case "E":case "f":case "F":case "g":case "G":return q=
+g,f=0>q?"-":r,r=["toExponential","toFixed","toPrecision"]["efg".indexOf(m.toLowerCase())],m=["toString","toUpperCase"]["eEfFgG".indexOf(m)%2],g=f+Math.abs(q)[r](n),b(g,f,p,h,l)[m]();default:return f}})}function ya(a){a.Ad=3621377730;a.ie=null;a.$=null;a.name=null;a.ib=null;a.dir=za;a.la=0;a.kb=100;a.N=200;a.h=a.n=0;a.O=0;a.o=Array(1+a.kb);a.g=Array(1+a.N);a.gc={};a.Kc={};a.valid=0;a.head=new Int32Array(1+a.kb);a.Pd=null;a.Y=null;a.ra=a.wa=Aa;a.ea=0;a.da=0;a.some=0;a.bf=Aa;a.Zd=0;a.Da=Aa;a.xa=0}
var Ba=exports.glp_create_prob=function(){var a={};ya(a);return a},Ca=exports.glp_set_prob_name=function(a,b){var c=a.$;null!=c&&0!=c.reason&&x("glp_set_prob_name: operation not allowed");a.name=b},Da=exports.glp_set_obj_name=function(a,b){var c=a.$;null!=c&&0!=c.reason&&x("glp_set_obj_name: operation not allowed");a.ib=b},Fa=exports.glp_set_obj_dir=function(a,b){var c=a.$;null!=c&&0!=c.reason&&x("glp_set_obj_dir: operation not allowed");b!=za&&b!=Ea&&x("glp_set_obj_dir: dir = "+b+"; invalid direction flag");
a.dir=b},La=exports.glp_add_rows=function(a,b){var c=a.$,d;1>b&&x("glp_add_rows: nrs = "+b+"; invalid number of rows");b>1E8-a.h&&x("glp_add_rows: nrs = "+b+"; too many rows");var e=a.h+b;if(a.kb<e){for(;a.kb<e;)a.kb+=a.kb;a.o.length=1+a.kb;a.head=new Int32Array(1+a.kb)}for(var f=a.h+1;f<=e;f++){a.o[f]=d={};d.ia=f;d.name=null;d.node=null;d.level=0;d.origin=0;d.qc=0;if(null!=c)switch(c.reason){case Ga:d.level=c.R.level;d.origin=Ha;break;case Ia:d.level=c.R.level,d.origin=Ja}d.type=Ka;d.c=d.f=0;d.l=
null;d.qa=1;d.stat=A;d.bind=0;d.w=d.M=0;d.Tb=d.nc=0;d.Va=0}a.h=e;a.valid=0;null!=c&&0!=c.reason&&(c.ne=1);return e-b+1},Oa=exports.glp_add_cols=function(a,b){var c=a.$;null!=c&&0!=c.reason&&x("glp_add_cols: operation not allowed");1>b&&x("glp_add_cols: ncs = "+b+"; invalid number of columns");b>1E8-a.n&&x("glp_add_cols: ncs = "+b+"; too many columns");var d=a.n+b;if(a.N<d){for(;a.N<d;)a.N+=a.N;a.g.length=1+a.N}for(var e=a.n+1;e<=d;e++)a.g[e]=c={},c.H=e,c.name=null,c.node=null,c.kind=Ma,c.type=C,c.c=
c.f=0,c.B=0,c.l=null,c.za=1,c.stat=Na,c.bind=0,c.w=c.M=0,c.Tb=c.nc=0,c.Va=0;a.n=d;return d-b+1},Pa=exports.glp_set_row_name=function(a,b,c){1<=b&&b<=a.h||x("glp_set_row_name: i = "+b+"; row number out of range");b=a.o[b];null!=b.name&&(delete a.gc[b.name],b.name=null);null!=c&&(b.name=c,a.gc[b.name]=b)},Qa=exports.glp_set_col_name=function(a,b,c){var d=a.$;null!=d&&0!=d.reason&&x("glp_set_col_name: operation not allowed");1<=b&&b<=a.n||x("glp_set_col_name: j = "+b+"; column number out of range");
b=a.g[b];null!=b.name&&(delete a.Kc[b.name],b.name=null);null!=c&&(b.name=c,a.Kc[b.name]=b)},Ua=exports.glp_set_row_bnds=function(a,b,c,d,e){1<=b&&b<=a.h||x("glp_set_row_bnds: i = "+b+"; row number out of range");a=a.o[b];a.type=c;switch(c){case Ka:a.c=a.f=0;a.stat!=A&&(a.stat=Ra);break;case Sa:a.c=d;a.f=0;a.stat!=A&&(a.stat=M);break;case Ta:a.c=0;a.f=e;a.stat!=A&&(a.stat=P);break;case Q:a.c=d;a.f=e;a.stat!=A&&a.stat!=M&&a.stat!=P&&(a.stat=Math.abs(d)<=Math.abs(e)?M:P);break;case C:a.c=a.f=d;a.stat!=
A&&(a.stat=Na);break;default:x("glp_set_row_bnds: i = "+b+"; type = "+c+"; invalid row type")}},Va=exports.glp_set_col_bnds=function(a,b,c,d,e){1<=b&&b<=a.n||x("glp_set_col_bnds: j = "+b+"; column number out of range");a=a.g[b];a.type=c;switch(c){case Ka:a.c=a.f=0;a.stat!=A&&(a.stat=Ra);break;case Sa:a.c=d;a.f=0;a.stat!=A&&(a.stat=M);break;case Ta:a.c=0;a.f=e;a.stat!=A&&(a.stat=P);break;case Q:a.c=d;a.f=e;a.stat!=A&&a.stat!=M&&a.stat!=P&&(a.stat=Math.abs(d)<=Math.abs(e)?M:P);break;case C:a.c=a.f=
d;a.stat!=A&&(a.stat=Na);break;default:x("glp_set_col_bnds: j = "+b+"; type = "+c+"; invalid column type")}},Xa=exports.glp_set_obj_coef=function(a,b,c){var d=a.$;null!=d&&0!=d.reason&&x("glp_set_obj_coef: operation not allowed");0<=b&&b<=a.n||x("glp_set_obj_coef: j = "+b+"; column number out of range");0==b?a.la=c:a.g[b].B=c},Ya=exports.glp_set_mat_row=function(a,b,c,d,e){var f,g,k;1<=b&&b<=a.h||x("glp_set_mat_row: i = "+b+"; row number out of range");for(var h=a.o[b];null!=h.l;)g=h.l,h.l=g.G,f=
g.g,null==g.va?f.l=g.L:g.va.L=g.L,null!=g.L&&(g.L.va=g.va),a.O--,f.stat==A&&(a.valid=0);0<=c&&c<=a.n||x("glp_set_mat_row: i = "+b+"; len = "+c+"; invalid row length ");c>5E8-a.O&&x("glp_set_mat_row: i = "+b+"; len = "+c+"; too many constraint coefficients");for(k=1;k<=c;k++)g=d[k],1<=g&&g<=a.n||x("glp_set_mat_row: i = "+b+"; ind["+k+"] = "+g+"; column index out of range"),f=a.g[g],null!=f.l&&f.l.o.ia==b&&x("glp_set_mat_row: i = "+b+"; ind["+k+"] = "+g+"; duplicate column indices not allowed"),g={},
a.O++,g.o=h,g.g=f,g.j=e[k],g.ya=null,g.G=h.l,g.va=null,g.L=f.l,null!=g.G&&(g.G.ya=g),null!=g.L&&(g.L.va=g),h.l=f.l=g,f.stat==A&&0!=g.j&&(a.valid=0);for(g=h.l;null!=g;g=b)b=g.G,0==g.j&&(null==g.ya?h.l=b:g.ya.G=b,null!=b&&(b.ya=g.ya),g.g.l=g.L,null!=g.L&&(g.L.va=null),a.O--)},Za=exports.glp_set_mat_col=function(a,b,c,d,e){var f=a.$,g,k,h;null!=f&&0!=f.reason&&x("glp_set_mat_col: operation not allowed");1<=b&&b<=a.n||x("glp_set_mat_col: j = "+b+"; column number out of range");for(f=a.g[b];null!=f.l;)k=
f.l,f.l=k.L,g=k.o,null==k.ya?g.l=k.G:k.ya.G=k.G,null!=k.G&&(k.G.ya=k.ya),a.O--;0<=c&&c<=a.h||x("glp_set_mat_col: j = "+b+"; len = "+c+"; invalid column length");c>5E8-a.O&&x("glp_set_mat_col: j = "+b+"; len = "+c+"; too many constraint coefficients");for(h=1;h<=c;h++)k=d[h],1<=k&&k<=a.h||x("glp_set_mat_col: j = "+b+"; ind["+h+"] = "+k+"; row index out of range"),g=a.o[k],null!=g.l&&g.l.g.H==b&&x("glp_set_mat_col: j = "+b+"; ind["+h+"] = "+k+"; duplicate row indices not allowed"),k={},a.O++,k.o=g,
k.g=f,k.j=e[h],k.ya=null,k.G=g.l,k.va=null,k.L=f.l,null!=k.G&&(k.G.ya=k),null!=k.L&&(k.L.va=k),g.l=f.l=k;for(k=f.l;null!=k;k=b)b=k.L,0==k.j&&(k.o.l=k.G,null!=k.G&&(k.G.ya=null),null==k.va?f.l=b:k.va.L=b,null!=b&&(b.va=k.va),a.O--);f.stat==A&&(a.valid=0)};
exports.glp_load_matrix=function(a,b,c,d,e){var f=a.$,g,k,h,l;null!=f&&0!=f.reason&&x("glp_load_matrix: operation not allowed");for(h=1;h<=a.h;h++)for(f=a.o[h];null!=f.l;)k=f.l,f.l=k.G,a.O--;for(k=1;k<=a.n;k++)a.g[k].l=null;0>b&&x("glp_load_matrix: ne = "+b+"; invalid number of constraint coefficients");5E8<b&&x("glp_load_matrix: ne = "+b+"; too many constraint coefficients");for(l=1;l<=b;l++)h=c[l],k=d[l],1<=h&&h<=a.h||x("glp_load_matrix: ia["+l+"] = "+h+"; row index out of range"),f=a.o[h],1<=k&&
k<=a.n||x("glp_load_matrix: ja["+l+"] = "+k+"; column index out of range"),g=a.g[k],k={},a.O++,k.o=f,k.g=g,k.j=e[l],k.ya=null,k.G=f.l,null!=k.G&&(k.G.ya=k),f.l=k;for(h=1;h<=a.h;h++)for(k=a.o[h].l;null!=k;k=k.G){g=k.g;if(null!=g.l&&g.l.o.ia==h){for(l=1;l<=b&&(c[l]!=h||d[l]!=g.H);l++);x("glp_load_mat: ia["+l+"] = "+h+"; ja["+l+"] = "+g.H+"; duplicate indices not allowed")}k.va=null;k.L=g.l;null!=k.L&&(k.L.va=k);g.l=k}for(h=1;h<=a.h;h++)for(f=a.o[h],k=f.l;null!=k;k=b)b=k.G,0==k.j&&(null==k.ya?f.l=b:
k.ya.G=b,null!=b&&(b.ya=k.ya),null==k.va?k.g.l=k.L:k.va.L=k.L,null!=k.L&&(k.L.va=k.va),a.O--);a.valid=0};
exports.glp_check_dup=function(a,b,c,d,e){var f,g,k,h,l;0>a&&x("glp_check_dup: m = %d; invalid parameter");0>b&&x("glp_check_dup: n = %d; invalid parameter");0>c&&x("glp_check_dup: ne = %d; invalid parameter");0<c&&null==d&&x("glp_check_dup: ia = "+d+"; invalid parameter");0<c&&null==e&&x("glp_check_dup: ja = "+e+"; invalid parameter");for(k=1;k<=c;k++)if(f=d[k],g=e[k],!(1<=f&&f<=a&&1<=g&&g<=b))return a=-k;if(0==a||0==b)return 0;h=new Int32Array(1+a);l=new Int32Array(1+c);b=new Int8Array(1+b);for(k=
1;k<=c;k++)f=d[k],l[k]=h[f],h[f]=k;for(f=1;f<=a;f++){for(k=h[f];0!=k;k=l[k]){g=e[k];if(b[g]){for(k=1;k<=c&&(d[k]!=f||e[k]!=g);k++);for(k++;k<=c&&(d[k]!=f||e[k]!=g);k++);return a=+k}b[g]=1}for(k=h[f];0!=k;k=l[k])b[e[k]]=0}return 0};
var $a=exports.glp_sort_matrix=function(a){var b,c,d;null!=a&&3621377730==a.Ad||x("glp_sort_matrix: P = "+a+"; invalid problem object");for(c=a.h;1<=c;c--)a.o[c].l=null;for(d=a.n;1<=d;d--)for(b=a.g[d].l;null!=b;b=b.L)c=b.o.ia,b.ya=null,b.G=a.o[c].l,null!=b.G&&(b.G.ya=b),a.o[c].l=b;for(d=a.n;1<=d;d--)a.g[d].l=null;for(c=a.h;1<=c;c--)for(b=a.o[c].l;null!=b;b=b.G)d=b.g.H,b.va=null,b.L=a.g[d].l,null!=b.L&&(b.L.va=b),a.g[d].l=b},ab=exports.glp_del_rows=function(a,b,c){var d=a.$,e,f,g;1<=b&&b<=a.h||x("glp_del_rows: nrs = "+
b+"; invalid number of rows");for(g=1;g<=b;g++)f=c[g],1<=f&&f<=a.h||x("glp_del_rows: num["+g+"] = "+f+"; row number out of range"),e=a.o[f],null!=d&&0!=d.reason&&(d.reason!=Ga&&d.reason!=Ia&&x("glp_del_rows: operation not allowed"),e.level!=d.R.level&&x("glp_del_rows: num["+g+"] = "+f+"; invalid attempt to delete row created not in current subproblem"),e.stat!=A&&x("glp_del_rows: num["+g+"] = "+f+"; invalid attempt to delete active row (constraint)"),d.pf=1),0==e.ia&&x("glp_del_rows: num["+g+"] = "+
f+"; duplicate row numbers not allowed"),Pa(a,f,null),Ya(a,f,0,null,null),e.ia=0;b=0;for(f=1;f<=a.h;f++)e=a.o[f],0!=e.ia&&(e.ia=++b,a.o[e.ia]=e);a.h=b;a.valid=0};
exports.glp_del_cols=function(a,b,c){var d=a.$,e,f;null!=d&&0!=d.reason&&x("glp_del_cols: operation not allowed");1<=b&&b<=a.n||x("glp_del_cols: ncs = "+b+"; invalid number of columns");for(f=1;f<=b;f++)d=c[f],1<=d&&d<=a.n||x("glp_del_cols: num["+f+"] = "+d+"; column number out of range"),e=a.g[d],0==e.H&&x("glp_del_cols: num["+f+"] = "+d+"; duplicate column numbers not allowed"),Qa(a,d,null),Za(a,d,0,null,null),e.H=0,e.stat==A&&(a.valid=0);b=0;for(d=1;d<=a.n;d++)e=a.g[d],0!=e.H&&(e.H=++b,a.g[e.H]=
e);a.n=b;if(a.valid)for(c=a.h,e=a.head,d=1;d<=b;d++)f=a.g[d].bind,0!=f&&(e[f]=c+d)};
var hb=exports.glp_copy_prob=function(a,b,c){var d=a.$,e={},f,g,k,h;null!=d&&0!=d.reason&&x("glp_copy_prob: operation not allowed");a==b&&x("glp_copy_prob: copying problem object to itself not allowed");c!=bb&&c!=cb&&x("glp_copy_prob: names = "+c+"; invalid parameter");db(a);c&&null!=b.name&&Ca(a,b.name);c&&null!=b.ib&&Da(a,b.ib);a.dir=b.dir;a.la=b.la;0<b.h&&La(a,b.h);0<b.n&&Oa(a,b.n);eb(b,e);fb(a,e);a.ra=b.ra;a.wa=b.wa;a.ea=b.ea;a.some=b.some;a.bf=b.bf;a.Zd=b.Zd;a.Da=b.Da;a.xa=b.xa;for(f=1;f<=b.h;f++)d=
a.o[f],e=b.o[f],c&&null!=e.name&&Pa(a,f,e.name),d.type=e.type,d.c=e.c,d.f=e.f,d.qa=e.qa,d.stat=e.stat,d.w=e.w,d.M=e.M,d.Tb=e.Tb,d.nc=e.nc,d.Va=e.Va;k=new Int32Array(1+b.h);h=new Float64Array(1+b.h);for(f=1;f<=b.n;f++)d=a.g[f],e=b.g[f],c&&null!=e.name&&Qa(a,f,e.name),d.kind=e.kind,d.type=e.type,d.c=e.c,d.f=e.f,d.B=e.B,g=gb(b,f,k,h),Za(a,f,g,k,h),d.za=e.za,d.stat=e.stat,d.w=e.w,d.M=e.M,d.Tb=e.Tb,d.nc=e.nc,d.Va=e.Va},db=exports.glp_erase_prob=function(a){var b=a.$;null!=b&&0!=b.reason&&x("glp_erase_prob: operation not allowed");
a.Ad=1061109567;a.ie=null;a.o=null;a.g=null;a.gc=null;a.Kc=null;a.head=null;a.Pd=null;a.Y=null;ya(a)};exports.glp_get_prob_name=function(a){return a.name};
var ib=exports.glp_get_obj_name=function(a){return a.ib},jb=exports.glp_get_obj_dir=function(a){return a.dir},kb=exports.glp_get_num_rows=function(a){return a.h},lb=exports.glp_get_num_cols=function(a){return a.n},mb=exports.glp_get_row_name=function(a,b){1<=b&&b<=a.h||x("glp_get_row_name: i = "+b+"; row number out of range");return a.o[b].name},nb=exports.glp_get_col_name=function(a,b){1<=b&&b<=a.n||x("glp_get_col_name: j = "+b+"; column number out of range");return a.g[b].name},pb=exports.glp_get_row_type=
function(a,b){1<=b&&b<=a.h||x("glp_get_row_type: i = "+b+"; row number out of range");return a.o[b].type},qb=exports.glp_get_row_lb=function(a,b){var c;1<=b&&b<=a.h||x("glp_get_row_lb: i = "+b+"; row number out of range");switch(a.o[b].type){case Ka:case Ta:c=-t;break;case Sa:case Q:case C:c=a.o[b].c}return c},rb=exports.glp_get_row_ub=function(a,b){var c;1<=b&&b<=a.h||x("glp_get_row_ub: i = "+b+"; row number out of range");switch(a.o[b].type){case Ka:case Sa:c=+t;break;case Ta:case Q:case C:c=a.o[b].f}return c},
sb=exports.glp_get_col_type=function(a,b){1<=b&&b<=a.n||x("glp_get_col_type: j = "+b+"; column number out of range");return a.g[b].type},tb=exports.glp_get_col_lb=function(a,b){var c;1<=b&&b<=a.n||x("glp_get_col_lb: j = "+b+"; column number out of range");switch(a.g[b].type){case Ka:case Ta:c=-t;break;case Sa:case Q:case C:c=a.g[b].c}return c},ub=exports.glp_get_col_ub=function(a,b){var c;1<=b&&b<=a.n||x("glp_get_col_ub: j = "+b+"; column number out of range");switch(a.g[b].type){case Ka:case Sa:c=
+t;break;case Ta:case Q:case C:c=a.g[b].f}return c};exports.glp_get_obj_coef=function(a,b){0<=b&&b<=a.n||x("glp_get_obj_coef: j = "+b+"; column number out of range");return 0==b?a.la:a.g[b].B};exports.glp_get_num_nz=function(a){return a.O};
var vb=exports.glp_get_mat_row=function(a,b,c,d){var e;1<=b&&b<=a.h||x("glp_get_mat_row: i = "+b+"; row number out of range");e=0;for(a=a.o[b].l;null!=a;a=a.G)e++,null!=c&&(c[e]=a.g.H),null!=d&&(d[e]=a.j);return e},gb=exports.glp_get_mat_col=function(a,b,c,d){var e;1<=b&&b<=a.n||x("glp_get_mat_col: j = "+b+"; column number out of range");e=0;for(a=a.g[b].l;null!=a;a=a.L)e++,null!=c&&(c[e]=a.o.ia),null!=d&&(d[e]=a.j);return e},wb=exports.glp_create_index=function(a){var b,c;if(null==a.gc)for(a.gc=
{},c=1;c<=a.h;c++)b=a.o[c],null!=b.name&&(a.gc[b.name]=b);if(null==a.Kc)for(a.Kc={},c=1;c<=a.n;c++)b=a.g[c],null!=b.name&&(a.Kc[b.name]=b)},xb=exports.glp_find_row=function(a,b){var c=0;null==a.gc&&x("glp_find_row: row name index does not exist");var d=a.gc[b];d&&(c=d.ia);return c},yb=exports.glp_find_col=function(a,b){var c=0;null==a.Kc&&x("glp_find_col: column name index does not exist");var d=a.Kc[b];d&&(c=d.H);return c},zb=exports.glp_delete_index=function(a){a.gc=null;a.gc=null},Ab=exports.glp_set_rii=
function(a,b,c){1<=b&&b<=a.h||x("glp_set_rii: i = "+b+"; row number out of range");0>=c&&x("glp_set_rii: i = "+b+"; rii = "+c+"; invalid scale factor");if(a.valid&&a.o[b].qa!=c)for(var d=a.o[b].l;null!=d;d=d.G)if(d.g.stat==A){a.valid=0;break}a.o[b].qa=c},Bb=exports.glp_set_sjj=function(a,b,c){1<=b&&b<=a.n||x("glp_set_sjj: j = "+b+"; column number out of range");0>=c&&x("glp_set_sjj: j = "+b+"; sjj = "+c+"; invalid scale factor");a.valid&&a.g[b].za!=c&&a.g[b].stat==A&&(a.valid=0);a.g[b].za=c},Cb=exports.glp_get_rii=
function(a,b){1<=b&&b<=a.h||x("glp_get_rii: i = "+b+"; row number out of range");return a.o[b].qa},Db=exports.glp_get_sjj=function(a,b){1<=b&&b<=a.n||x("glp_get_sjj: j = "+b+"; column number out of range");return a.g[b].za},Eb=exports.glp_unscale_prob=function(a){var b=kb(a),c=lb(a),d;for(d=1;d<=b;d++)Ab(a,d,1);for(b=1;b<=c;b++)Bb(a,b,1)},Fb=exports.glp_set_row_stat=function(a,b,c){1<=b&&b<=a.h||x("glp_set_row_stat: i = "+b+"; row number out of range");c!=A&&c!=M&&c!=P&&c!=Ra&&c!=Na&&x("glp_set_row_stat: i = "+
b+"; stat = "+c+"; invalid status");b=a.o[b];if(c!=A)switch(b.type){case Ka:c=Ra;break;case Sa:c=M;break;case Ta:c=P;break;case Q:c!=P&&(c=M);break;case C:c=Na}if(b.stat==A&&c!=A||b.stat!=A&&c==A)a.valid=0;b.stat=c},Gb=exports.glp_set_col_stat=function(a,b,c){1<=b&&b<=a.n||x("glp_set_col_stat: j = "+b+"; column number out of range");c!=A&&c!=M&&c!=P&&c!=Ra&&c!=Na&&x("glp_set_col_stat: j = "+b+"; stat = "+c+"; invalid status");b=a.g[b];if(c!=A)switch(b.type){case Ka:c=Ra;break;case Sa:c=M;break;case Ta:c=
P;break;case Q:c!=P&&(c=M);break;case C:c=Na}if(b.stat==A&&c!=A||b.stat!=A&&c==A)a.valid=0;b.stat=c},Hb=exports.glp_std_basis=function(a){var b;for(b=1;b<=a.h;b++)Fb(a,b,A);for(b=1;b<=a.n;b++){var c=a.g[b];c.type==Q&&Math.abs(c.c)>Math.abs(c.f)?Gb(a,b,P):Gb(a,b,M)}},sc=exports.glp_simplex=function(a,b){function c(a,b){var c;if(!Ib(a)&&(c=Jb(a),0!=c&&(c==Kb?b.s>=Mb&&y("glp_simplex: initial basis is invalid"):c==Nb?b.s>=Mb&&y("glp_simplex: initial basis is singular"):c==Ob&&b.s>=Mb&&y("glp_simplex: initial basis is ill-conditioned")),
0!=c))return c;b.hb==Pb?c=Qb(a,b):b.hb==Rb?(c=Sb(a,b),c==Tb&&a.valid&&(c=Qb(a,b))):b.hb==Ub&&(c=Sb(a,b));return c}function d(a,b){function d(){Vb(e,f);f=null;Wb(e,a);return r=0}var e,f=null,g={},r;b.s>=Xb&&y("Preprocessing...");e=Yb();Zb(e,a,$b);r=ac(e,0);0!=r&&(r==bc?b.s>=Xb&&y("PROBLEM HAS NO PRIMAL FEASIBLE SOLUTION"):r==cc&&b.s>=Xb&&y("PROBLEM HAS NO DUAL FEASIBLE SOLUTION"));if(0!=r)return r;f=Ba();dc(e,f);if(0==f.h&&0==f.n)return f.ra=f.wa=ec,f.ea=f.la,b.s>=fc&&0==b.cb&&y(a.da+": obj = "+f.ea+
"  infeas = 0.0"),b.s>=Xb&&y("OPTIMAL SOLUTION FOUND BY LP PREPROCESSOR"),d();b.s>=Xb&&y(f.h+" row"+(1==f.h?"":"s")+", "+f.n+" column"+(1==f.n?"":"s")+", "+f.O+" non-zero"+(1==f.O?"":"s")+"");eb(a,g);fb(f,g);var g=pa,p=g.Hb;g.Hb=!p||b.s<Xb?cb:bb;gc(f,hc);g.Hb=p;g=pa;p=g.Hb;g.Hb=!p||b.s<Xb?cb:bb;ic(f);g.Hb=p;f.da=a.da;r=c(f,b);a.da=f.da;return 0!=r||f.ra!=ec||f.wa!=ec?(b.s>=Mb&&y("glp_simplex: unable to recover undefined or non-optimal solution"),0==r&&(f.ra==jc?r=bc:f.wa==jc&&(r=cc)),r):d()}function e(a,
b){function c(){f.stat=M;f.w=f.c}function d(){f.stat=P;f.w=f.f}var e,f,g,p,u;a.valid=0;a.ra=a.wa=ec;a.ea=a.la;p=u=a.some=0;for(g=1;g<=a.h;g++){e=a.o[g];e.stat=A;e.w=e.M=0;if(e.type==Sa||e.type==Q||e.type==C)e.c>+b.Ib&&(a.ra=jc,0==a.some&&b.hb!=Pb&&(a.some=g)),p<+e.c&&(p=+e.c);if(e.type==Ta||e.type==Q||e.type==C)e.f<-b.Ib&&(a.ra=jc,0==a.some&&b.hb!=Pb&&(a.some=g)),p<-e.f&&(p=-e.f)}for(e=g=1;e<=a.n;e++)f=a.g[e],g<Math.abs(f.B)&&(g=Math.abs(f.B));g=(a.dir==za?1:-1)/g;for(e=1;e<=a.n;e++){f=a.g[e];f.type==
Ka?(f.stat=Ra,f.w=0):f.type==Sa?c():f.type==Ta?d():f.type==Q?0<g*f.B?c():0>g*f.B?d():Math.abs(f.c)<=Math.abs(f.f)?c():d():f.type==C&&(f.stat=Na,f.w=f.c);f.M=f.B;a.ea+=f.B*f.w;if(f.type==Ka||f.type==Sa)g*f.M<-b.vb&&(a.wa=jc,0==a.some&&b.hb==Pb&&(a.some=a.h+e)),u<-g*f.M&&(u=-g*f.M);if(f.type==Ka||f.type==Ta)g*f.M>+b.vb&&(a.wa=jc,0==a.some&&b.hb==Pb&&(a.some=a.h+e)),u<+g*f.M&&(u=+g*f.M)}b.s>=fc&&0==b.cb&&y("~"+a.da+": obj = "+a.ea+"  infeas = "+(b.hb==Pb?p:u)+"");b.s>=Xb&&0==b.cb&&(a.ra==ec&&a.wa==ec?
y("OPTIMAL SOLUTION FOUND"):a.ra==jc?y("PROBLEM HAS NO FEASIBLE SOLUTION"):b.hb==Pb?y("PROBLEM HAS UNBOUNDED SOLUTION"):y("PROBLEM HAS NO DUAL FEASIBLE SOLUTION"))}var f;null!=a&&3621377730==a.Ad||x("glp_simplex: P = "+a+"; invalid problem object");null!=a.$&&0!=a.$.reason&&x("glp_simplex: operation not allowed");null==b&&(b=new kc);b.s!=lc&&b.s!=Mb&&b.s!=fc&&b.s!=Xb&&b.s!=mc&&x("glp_simplex: msg_lev = "+b.s+"; invalid parameter");b.hb!=Pb&&b.hb!=Rb&&b.hb!=Ub&&x("glp_simplex: meth = "+b.hb+"; invalid parameter");
b.ed!=nc&&b.ed!=oc&&x("glp_simplex: pricing = "+b.ed+"; invalid parameter");b.le!=pc&&b.le!=qc&&x("glp_simplex: r_test = "+b.le+"; invalid parameter");0<b.Ib&&1>b.Ib||x("glp_simplex: tol_bnd = "+b.Ib+"; invalid parameter");0<b.vb&&1>b.vb||x("glp_simplex: tol_dj = "+b.vb+"; invalid parameter");0<b.ve&&1>b.ve||x("glp_simplex: tol_piv = "+b.ve+"; invalid parameter");0>b.pc&&x("glp_simplex: it_lim = "+b.pc+"; invalid parameter");0>b.ub&&x("glp_simplex: tm_lim = "+b.ub+"; invalid parameter");1>b.dc&&x("glp_simplex: out_frq = "+
b.dc+"; invalid parameter");0>b.cb&&x("glp_simplex: out_dly = "+b.cb+"; invalid parameter");b.yc!=bb&&b.yc!=cb&&x("glp_simplex: presolve = "+b.yc+"; invalid parameter");a.ra=a.wa=Aa;a.ea=0;a.some=0;for(f=1;f<=a.h;f++){var g=a.o[f];if(g.type==Q&&g.c>=g.f)return b.s>=Mb&&y("glp_simplex: row "+f+": lb = "+g.c+", ub = "+g.f+"; incorrect bounds"),f=rc}for(f=1;f<=a.n;f++)if(g=a.g[f],g.type==Q&&g.c>=g.f)return b.s>=Mb&&y("glp_simplex: column "+f+": lb = "+g.c+", ub = "+g.f+"; incorrect bounds"),f=rc;b.s>=
Xb&&(y("GLPK Simplex Optimizer, v"+sa()+""),y(a.h+" row"+(1==a.h?"":"s")+", "+a.n+" column"+(1==a.n?"":"s")+", "+a.O+" non-zero"+(1==a.O?"":"s")+""));0==a.O?(e(a,b),f=0):f=b.yc?d(a,b):c(a,b);return f},kc=exports.SMCP=function(a){a=a||{};this.s=a.msg_lev||Xb;this.hb=a.meth||Pb;this.ed=a.pricing||oc;this.le=a.r_test||qc;this.Ib=a.tol_bnd||1E-7;this.vb=a.tol_dj||1E-7;this.ve=a.tol_piv||1E-10;this.ef=a.obj_ll||-t;this.ff=a.obj_ul||+t;this.pc=a.it_lim||2147483647;this.ub=a.tm_lim||2147483647;this.dc=a.out_frq||
500;this.cb=a.out_dly||0;this.yc=a.presolve||cb},xc=exports.glp_get_status=function(a){var b;b=tc(a);switch(b){case ec:switch(uc(a)){case ec:b=vc;break;case jc:b=wc}}return b},tc=exports.glp_get_prim_stat=function(a){return a.ra},uc=exports.glp_get_dual_stat=function(a){return a.wa},yc=exports.glp_get_obj_val=function(a){return a.ea},zc=exports.glp_get_row_stat=function(a,b){1<=b&&b<=a.h||x("glp_get_row_stat: i = "+b+"; row number out of range");return a.o[b].stat},Ac=exports.glp_get_row_prim=function(a,
b){1<=b&&b<=a.h||x("glp_get_row_prim: i = "+b+"; row number out of range");return a.o[b].w},Bc=exports.glp_get_row_dual=function(a,b){1<=b&&b<=a.h||x("glp_get_row_dual: i = "+b+"; row number out of range");return a.o[b].M},Cc=exports.glp_get_col_stat=function(a,b){1<=b&&b<=a.n||x("glp_get_col_stat: j = "+b+"; column number out of range");return a.g[b].stat},Dc=exports.glp_get_col_prim=function(a,b){1<=b&&b<=a.n||x("glp_get_col_prim: j = "+b+"; column number out of range");return a.g[b].w},Ec=exports.glp_get_col_dual=
function(a,b){1<=b&&b<=a.n||x("glp_get_col_dual: j = "+b+"; column number out of range");return a.g[b].M};exports.glp_get_unbnd_ray=function(a){var b=a.some;b>a.h+a.n&&(b=0);return b};
var Hc=exports.glp_set_col_kind=function(a,b,c){1<=b&&b<=a.n||x("glp_set_col_kind: j = "+b+"; column number out of range");var d=a.g[b];switch(c){case Ma:d.kind=Ma;break;case Fc:d.kind=Fc;break;case Gc:d.kind=Fc;d.type==Q&&0==d.c&&1==d.f||Va(a,b,Q,0,1);break;default:x("glp_set_col_kind: j = "+b+"; kind = "+c+"; invalid column kind")}},Ic=exports.glp_get_col_kind=function(a,b){1<=b&&b<=a.n||x("glp_get_col_kind: j = "+b+"; column number out of range");var c=a.g[b],d=c.kind;switch(d){case Fc:c.type==
Q&&0==c.c&&1==c.f&&(d=Gc)}return d},Jc=exports.glp_get_num_int=function(a){for(var b,c=0,d=1;d<=a.n;d++)b=a.g[d],b.kind==Fc&&c++;return c},Kc=exports.glp_get_num_bin=function(a){for(var b,c=0,d=1;d<=a.n;d++)b=a.g[d],b.kind==Fc&&b.type==Q&&0==b.c&&1==b.f&&c++;return c};
exports.glp_intopt=function(a,b){function c(a,b){var c;if(xc(a)!=vc)return b.s>=Mb&&y("glp_intopt: optimal basis to initial LP relaxation not provided"),c=Lc;b.s>=Xb&&y("Integer optimization begins...");var d=a.h;c=a.n;var e,f;a.$=e={};e.n=c;e.wc=d;e.cc=new Int8Array(1+d+c);e.ad=new Float64Array(1+d+c);e.bd=new Float64Array(1+d+c);e.jf=new Int8Array(1+d+c);e.hf=new Float64Array(1+d+c);e.gf=new Float64Array(1+d+c);for(f=1;f<=d;f++){var q=a.o[f];e.cc[f]=q.type;e.ad[f]=q.c;e.bd[f]=q.f;e.jf[f]=q.stat;
e.hf[f]=q.w;e.gf[f]=q.M}for(f=1;f<=c;f++)q=a.g[f],e.cc[d+f]=q.type,e.ad[d+f]=q.c,e.bd[d+f]=q.f,e.jf[d+f]=q.stat,e.hf[d+f]=q.w,e.gf[d+f]=q.M;e.dh=a.ea;e.Dd=0;e.Rc=0;e.Ca=null;e.head=e.$a=null;e.Od=e.Vf=e.Fg=0;e.Eg=0;e.qe=null;e.oe=e.re=null;e.pe=null;e.R=null;e.F=a;e.$c=new Int8Array(1+c);e.Bg=e.Cg=0;e.mf=null;e.kf=e.nf=null;e.lf=null;d={size:0};d.head=d.$a=null;d.$g=0;d.R=null;e.local=d;e.Tf=null;e.Le=null;e.Ed=null;e.xg=new Int32Array(1+c);e.Og=new Float64Array(1+c);e.u=b;e.ic=la();e.Hg=0;e.lh=0;
e.reason=0;e.ne=0;e.pf=0;e.Sc=0;e.Ff=0;e.sd=0;e.Cd=0;e.stop=0;Mc(e,null);c=Nc(e);var d=e.F,r=d.h;f=d.n;if(r!=e.wc){var p,r=r-e.wc;p=new Int32Array(1+r);for(q=1;q<=r;q++)p[q]=e.wc+q;ab(d,r,p)}r=e.wc;for(q=1;q<=r;q++)Ua(d,q,e.cc[q],e.ad[q],e.bd[q]),Fb(d,q,e.jf[q]),d.o[q].w=e.hf[q],d.o[q].M=e.gf[q];for(q=1;q<=f;q++)Va(d,q,e.cc[r+q],e.ad[r+q],e.bd[r+q]),Gb(d,q,e.jf[r+q]),d.g[q].w=e.hf[r+q],d.g[q].M=e.gf[r+q];d.ra=d.wa=ec;d.ea=e.dh;Oc(e.local);d.$=null;0==c?a.Da==ec?(b.s>=Xb&&y("INTEGER OPTIMAL SOLUTION FOUND"),
a.Da=vc):(b.s>=Xb&&y("PROBLEM HAS NO INTEGER FEASIBLE SOLUTION"),a.Da=jc):c==Pc?b.s>=Xb&&y("RELATIVE MIP GAP TOLERANCE REACHED; SEARCH TERMINATED"):c==Qc?b.s>=Xb&&y("TIME LIMIT EXCEEDED; SEARCH TERMINATED"):c==Tb?b.s>=Mb&&y("glp_intopt: cannot solve current LP relaxation"):c==Rc&&b.s>=Xb&&y("SEARCH TERMINATED BY APPLICATION");return c}function d(a,b){function d(){Vb(f,m);m=null;Wb(f,a);return r}var e=pa.Hb,f,m=null,q={},r;b.s>=Xb&&y("Preprocessing...");f=Yb();Zb(f,a,Sc);pa.Hb=!e||b.s<Xb?cb:bb;r=Tc(f,
b);pa.Hb=e;0!=r&&(r==bc?b.s>=Xb&&y("PROBLEM HAS NO PRIMAL FEASIBLE SOLUTION"):r==cc&&b.s>=Xb&&y("LP RELAXATION HAS NO DUAL FEASIBLE SOLUTION"));if(0!=r)return r;m=Ba();dc(f,m);if(0==m.h&&0==m.n)return m.Da=vc,m.xa=m.la,b.s>=Xb&&(y("Objective value = "+m.xa+""),y("INTEGER OPTIMAL SOLUTION FOUND BY MIP PREPROCESSOR")),d();if(b.s>=Xb){var p=Jc(m),u=Kc(m);y(m.h+" row"+(1==m.h?"":"s")+", "+m.n+" column"+(1==m.n?"":"s")+", "+m.O+" non-zero"+(1==m.O?"":"s")+"");y(p+" integer variable"+(1==p?"":"s")+", "+
(0==u?"none of":1==p&&1==u?"":1==u?"one of":u==p?"all of":u+" of")+" which "+(1==u?"is":"are")+" binary")}eb(a,q);fb(m,q);pa.Hb=!e||b.s<Xb?cb:bb;gc(m,Uc|Vc|Wc|Xc);pa.Hb=e;pa.Hb=!e||b.s<Xb?cb:bb;ic(m);pa.Hb=e;b.s>=Xb&&y("Solving LP relaxation...");e=new kc;e.s=b.s;m.da=a.da;r=sc(m,e);a.da=m.da;if(0!=r)return b.s>=Mb&&y("glp_intopt: cannot solve LP relaxation"),r=Tb;r=xc(m);r==vc?r=0:r==jc?r=bc:r==wc&&(r=cc);if(0!=r)return r;m.da=a.da;r=c(m,b);a.da=m.da;return m.Da!=vc&&m.Da!=ec?(a.Da=m.Da,r):d()}var e,
f;null!=a&&3621377730==a.Ad||x("glp_intopt: P = "+a+"; invalid problem object");null!=a.$&&x("glp_intopt: operation not allowed");null==b&&(b=new Yc);b.s!=lc&&b.s!=Mb&&b.s!=fc&&b.s!=Xb&&b.s!=mc&&x("glp_intopt: msg_lev = "+b.s+"; invalid parameter");b.Lb!=Zc&&b.Lb!=$c&&b.Lb!=ad&&b.Lb!=bd&&b.Lb!=cd&&x("glp_intopt: br_tech = "+b.Lb+"; invalid parameter");b.lc!=dd&&b.lc!=ed&&b.lc!=fd&&b.lc!=gd&&x("glp_intopt: bt_tech = "+b.lc+"; invalid parameter");0<b.Xb&&1>b.Xb||x("glp_intopt: tol_int = "+b.Xb+"; invalid parameter");
0<b.ue&&1>b.ue||x("glp_intopt: tol_obj = "+b.ue+"; invalid parameter");0>b.ub&&x("glp_intopt: tm_lim = "+b.ub+"; invalid parameter");0>b.dc&&x("glp_intopt: out_frq = "+b.dc+"; invalid parameter");0>b.cb&&x("glp_intopt: out_dly = "+b.cb+"; invalid parameter");0<=b.Ke&&256>=b.Ke||x("glp_intopt: cb_size = "+b.Ke+"; invalid parameter");b.dd!=hd&&b.dd!=id&&b.dd!=jd&&x("glp_intopt: pp_tech = "+b.dd+"; invalid parameter");0>b.ae&&x("glp_intopt: mip_gap = "+b.ae+"; invalid parameter");b.Bd!=bb&&b.Bd!=cb&&
x("glp_intopt: mir_cuts = "+b.Bd+"; invalid parameter");b.yd!=bb&&b.yd!=cb&&x("glp_intopt: gmi_cuts = "+b.yd+"; invalid parameter");b.vd!=bb&&b.vd!=cb&&x("glp_intopt: cov_cuts = "+b.vd+"; invalid parameter");b.td!=bb&&b.td!=cb&&x("glp_intopt: clq_cuts = "+b.td+"; invalid parameter");b.yc!=bb&&b.yc!=cb&&x("glp_intopt: presolve = "+b.yc+"; invalid parameter");b.qd!=bb&&b.qd!=cb&&x("glp_intopt: binarize = "+b.qd+"; invalid parameter");b.Ve!=bb&&b.Ve!=cb&&x("glp_intopt: fp_heur = "+b.Ve+"; invalid parameter");
a.Da=Aa;a.xa=0;for(e=1;e<=a.h;e++)if(f=a.o[e],f.type==Q&&f.c>=f.f)return b.s>=Mb&&y("glp_intopt: row "+e+": lb = "+f.c+", ub = "+f.f+"; incorrect bounds"),e=rc;for(e=1;e<=a.n;e++)if(f=a.g[e],f.type==Q&&f.c>=f.f)return b.s>=Mb&&y("glp_intopt: column "+e+": lb = "+f.c+", ub = "+f.f+"; incorrect bounds"),e=rc;for(e=1;e<=a.n;e++)if(f=a.g[e],f.kind==Fc){if((f.type==Sa||f.type==Q)&&f.c!=Math.floor(f.c))return b.s>=Mb&&y("glp_intopt: integer column "+e+" has non-integer lower bound "+f.c+""),e=rc;if((f.type==
Ta||f.type==Q)&&f.f!=Math.floor(f.f))return b.s>=Mb&&y("glp_intopt: integer column "+e+" has non-integer upper bound "+f.f+""),e=rc;if(f.type==C&&f.c!=Math.floor(f.c))return b.s>=Mb&&y("glp_intopt: integer column "+e+" has non-integer fixed value "+f.c+""),e=rc}b.s>=Xb&&(e=Jc(a),f=Kc(a),y("GLPK Integer Optimizer, v"+sa()+""),y(a.h+" row"+(1==a.h?"":"s")+", "+a.n+" column"+(1==a.n?"":"s")+", "+a.O+" non-zero"+(1==a.O?"":"s")+""),y(e+" integer variable"+(1==e?"":"s")+", "+(0==f?"none of":1==e&&1==f?
"":1==f?"one of":f==e?"all of":f+" of")+" which "+(1==f?"is":"are")+" binary"));return e=b.yc?d(a,b):c(a,b)};
var Yc=exports.IOCP=function(a){a=a||{};this.s=a.msg_lev||Xb;this.Lb=a.br_tech||bd;this.lc=a.bt_tech||fd;this.Xb=a.tol_int||1E-5;this.ue=a.tol_obj||1E-7;this.ub=a.tm_lim||2147483647;this.dc=a.out_frq||5E3;this.cb=a.out_dly||1E4;this.rb=a.cb_func||null;this.Tc=a.cb_info||null;this.Ke=a.cb_size||0;this.dd=a.pp_tech||jd;this.ae=a.mip_gap||0;this.Bd=a.mir_cuts||cb;this.yd=a.gmi_cuts||cb;this.vd=a.cov_cuts||cb;this.td=a.clq_cuts||cb;this.yc=a.presolve||cb;this.qd=a.binarize||cb;this.Ve=a.fp_heur||cb};
exports.glp_mip_status=function(a){return a.Da};exports.glp_mip_obj_val=function(a){return a.xa};
var kd=exports.glp_mip_row_val=function(a,b){1<=b&&b<=a.h||x("glp_mip_row_val: i = "+b+"; row number out of range");return a.o[b].Va},ld=exports.glp_mip_col_val=function(a,b){1<=b&&b<=a.n||x("glp_mip_col_val: j = "+b+"; column number out of range");return a.g[b].Va},Ib=exports.glp_bf_exists=function(a){return 0==a.h||a.valid},Jb=exports.glp_factorize=function(a){function b(a,b,c,d){var e=a.h,f;f=a.head[b];if(f<=e)b=1,c[1]=f,d[1]=1;else for(b=0,a=a.g[f-e].l;null!=a;a=a.L)b++,c[b]=a.o.ia,d[b]=-a.o.qa*
a.j*a.g.za;return b}var c=a.h,d=a.n,e=a.o,f=a.g,g=a.head,k,h,l;k=a.valid=0;for(h=1;h<=c+d;h++)if(h<=c?(l=e[h].stat,e[h].bind=0):(l=f[h-c].stat,f[h-c].bind=0),l==A){k++;if(k>c)return a=Kb;g[k]=h;h<=c?e[h].bind=k:f[h-c].bind=k}if(k<c)return a=Kb;if(0<c){null==a.Y&&(a.Y={valid:0,type:md,jb:null,bb:null,zd:0,ec:.1,xc:4,hc:1,Ob:1E-15,sc:1E10,Zc:100,jc:1E-6,vc:100,jd:1E3,xh:-1,dg:0},nd(a));switch(od(a.Y,c,b,a)){case pd:return a=Nb;case qd:return a=Ob}a.valid=1}return 0};
exports.glp_bf_updated=function(a){0==a.h||a.valid||x("glp_bf_update: basis factorization does not exist");return 0==a.h?0:a.Y.dg};var eb=exports.glp_get_bfcp=function(a,b){var c=a.Pd;null==c?(b.type=md,b.zd=0,b.ec=.1,b.xc=4,b.hc=bb,b.Ob=1E-15,b.sc=1E10,b.Zc=100,b.jc=1E-6,b.vc=100,b.jd=0):ga(b,c)};function nd(a){var b={};eb(a,b);a=a.Y;a.type=b.type;a.zd=b.zd;a.ec=b.ec;a.xc=b.xc;a.hc=b.hc;a.Ob=b.Ob;a.sc=b.sc;a.Zc=b.Zc;a.jc=b.jc;a.vc=b.vc;a.jd=b.jd}
var fb=exports.glp_set_bfcp=function(a,b){var c=a.Pd;null==b?null!=c&&(a.Pd=null):(null==c&&(c=a.Pd={}),ga(c,b),c.type!=md&&c.type!=rd&&c.type!=sd&&x("glp_set_bfcp: type = "+c.type+"; invalid parameter"),0>c.zd&&x("glp_set_bfcp: lu_size = "+c.zd+"; invalid parameter"),0<c.ec&&1>c.ec||x("glp_set_bfcp: piv_tol = "+c.ec+"; invalid parameter"),1>c.xc&&x("glp_set_bfcp: piv_lim = "+c.xc+"; invalid parameter"),c.hc!=bb&&c.hc!=cb&&x("glp_set_bfcp: suhl = "+c.hc+"; invalid parameter"),0<=c.Ob&&1E-6>=c.Ob||
x("glp_set_bfcp: eps_tol = "+c.Ob+"; invalid parameter"),1>c.sc&&x("glp_set_bfcp: max_gro = "+c.sc+"; invalid parameter"),1<=c.Zc&&32767>=c.Zc||x("glp_set_bfcp: nfs_max = "+c.Zc+"; invalid parameter"),0<c.jc&&1>c.jc||x("glp_set_bfcp: upd_tol = "+c.jc+"; invalid parameter"),1<=c.vc&&32767>=c.vc||x("glp_set_bfcp: nrs_max = "+c.vc+"; invalid parameter"),0>c.jd&&x("glp_set_bfcp: rs_size = "+c.vc+"; invalid parameter"),0==c.jd&&(c.jd=20*c.vc));null!=a.Y&&nd(a)},td=exports.glp_get_bhead=function(a,b){0==
a.h||a.valid||x("glp_get_bhead: basis factorization does not exist");1<=b&&b<=a.h||x("glp_get_bhead: k = "+b+"; index out of range");return a.head[b]},ud=exports.glp_get_row_bind=function(a,b){0==a.h||a.valid||x("glp_get_row_bind: basis factorization does not exist");1<=b&&b<=a.h||x("glp_get_row_bind: i = "+b+"; row number out of range");return a.o[b].bind},vd=exports.glp_get_col_bind=function(a,b){0==a.h||a.valid||x("glp_get_col_bind: basis factorization does not exist");1<=b&&b<=a.n||x("glp_get_col_bind: j = "+
b+"; column number out of range");return a.g[b].bind},xd=exports.glp_ftran=function(a,b){var c=a.h,d=a.o,e=a.g,f,g;0==c||a.valid||x("glp_ftran: basis factorization does not exist");for(f=1;f<=c;f++)b[f]*=d[f].qa;0<c&&wd(a.Y,b);for(f=1;f<=c;f++)g=a.head[f],b[f]=g<=c?b[f]/d[g].qa:b[f]*e[g-c].za},zd=exports.glp_btran=function(a,b){var c=a.h,d=a.o,e=a.g,f,g;0==c||a.valid||x("glp_btran: basis factorization does not exist");for(f=1;f<=c;f++)g=a.head[f],b[f]=g<=c?b[f]/d[g].qa:b[f]*e[g-c].za;0<c&&yd(a.Y,
b);for(f=1;f<=c;f++)b[f]*=d[f].qa};
exports.glp_warm_up=function(a){var b,c,d,e,f;a.ra=a.wa=Aa;a.ea=0;a.some=0;for(d=1;d<=a.h;d++)b=a.o[d],b.w=b.M=0;for(d=1;d<=a.n;d++)b=a.g[d],b.w=b.M=0;if(!Ib(a)&&(e=Jb(a),0!=e))return e;e=new Float64Array(1+a.h);for(d=1;d<=a.h;d++)b=a.o[d],b.stat!=A&&(b.stat==M?b.w=b.c:b.stat==P?b.w=b.f:b.stat==Ra?b.w=0:b.stat==Na&&(b.w=b.c),e[d]-=b.w);for(d=1;d<=a.n;d++)if(b=a.g[d],b.stat!=A&&(b.stat==M?b.w=b.c:b.stat==P?b.w=b.f:b.stat==Ra?b.w=0:b.stat==Na&&(b.w=b.c),0!=b.w))for(c=b.l;null!=c;c=c.L)e[c.o.ia]+=c.j*
b.w;xd(a,e);a.ra=ec;for(d=1;d<=a.h;d++)if(b=a.o[d],b.stat==A){b.w=e[b.bind];c=b.type;if(c==Sa||c==Q||c==C)f=1E-6+1E-9*Math.abs(b.c),b.w<b.c-f&&(a.ra=Ad);if(c==Ta||c==Q||c==C)f=1E-6+1E-9*Math.abs(b.f),b.w>b.f+f&&(a.ra=Ad)}for(d=1;d<=a.n;d++)if(b=a.g[d],b.stat==A){b.w=e[b.bind];c=b.type;if(c==Sa||c==Q||c==C)f=1E-6+1E-9*Math.abs(b.c),b.w<b.c-f&&(a.ra=Ad);if(c==Ta||c==Q||c==C)f=1E-6+1E-9*Math.abs(b.f),b.w>b.f+f&&(a.ra=Ad)}a.ea=a.la;for(d=1;d<=a.n;d++)b=a.g[d],a.ea+=b.B*b.w;for(d=1;d<=a.h;d++)e[d]=0;for(d=
1;d<=a.n;d++)b=a.g[d],b.stat==A&&(e[b.bind]=b.B);zd(a,e);a.wa=ec;for(d=1;d<=a.h;d++)if(b=a.o[d],b.stat==A)b.M=0;else if(b.M=-e[d],c=b.stat,b=a.dir==za?+b.M:-b.M,(c==Ra||c==M)&&-1E-5>b||(c==Ra||c==P)&&1E-5<b)a.wa=Ad;for(d=1;d<=a.n;d++)if(b=a.g[d],b.stat==A)b.M=0;else{b.M=b.B;for(c=b.l;null!=c;c=c.L)b.M+=c.j*e[c.o.ia];c=b.stat;b=a.dir==za?+b.M:-b.M;if((c==Ra||c==M)&&-1E-5>b||(c==Ra||c==P)&&1E-5<b)a.wa=Ad}return 0};
var Bd=exports.glp_eval_tab_row=function(a,b,c,d){var e=a.h,f=a.n,g,k,h,l,n,m,q;0==e||a.valid||x("glp_eval_tab_row: basis factorization does not exist");1<=b&&b<=e+f||x("glp_eval_tab_row: k = "+b+"; variable number out of range");g=b<=e?ud(a,b):vd(a,b-e);0==g&&x("glp_eval_tab_row: k = "+b+"; variable must be basic");m=new Float64Array(1+e);l=new Int32Array(1+e);q=new Float64Array(1+e);m[g]=1;zd(a,m);k=0;for(b=1;b<=e+f;b++){if(b<=e){if(zc(a,b)==A)continue;n=-m[b]}else{if(Cc(a,b-e)==A)continue;h=gb(a,
b-e,l,q);n=0;for(g=1;g<=h;g++)n+=m[l[g]]*q[g]}0!=n&&(k++,c[k]=b,d[k]=n)}return k},Cd=exports.glp_eval_tab_col=function(a,b,c,d){var e=a.h,f=a.n,g;0==e||a.valid||x("glp_eval_tab_col: basis factorization does not exist");1<=b&&b<=e+f||x("glp_eval_tab_col: k = "+b+"; variable number out of range");(b<=e?zc(a,b):Cc(a,b-e))==A&&x("glp_eval_tab_col: k = "+b+"; variable must be non-basic");f=new Float64Array(1+e);if(b<=e)f[b]=-1;else for(g=gb(a,b-e,c,d),b=1;b<=g;b++)f[c[b]]=d[b];xd(a,f);g=0;for(b=1;b<=e;b++)0!=
f[b]&&(g++,c[g]=td(a,b),d[g]=f[b]);return g},Dd=exports.glp_transform_row=function(a,b,c,d){var e,f,g,k,h,l,n,m,q,r;Ib(a)||x("glp_transform_row: basis factorization does not exist ");f=kb(a);g=lb(a);m=new Float64Array(1+g);0<=b&&b<=g||x("glp_transform_row: len = "+b+"; invalid row length");for(k=1;k<=b;k++)e=c[k],1<=e&&e<=g||x("glp_transform_row: ind["+k+"] = "+e+"; column index out of range"),0==d[k]&&x("glp_transform_row: val["+k+"] = 0; zero coefficient not allowed"),0!=m[e]&&x("glp_transform_row: ind["+
k+"] = "+e+"; duplicate column indices not allowed"),m[e]=d[k];q=new Float64Array(1+f);for(e=1;e<=f;e++)b=td(a,e),q[e]=b<=f?0:m[b-f];zd(a,q);b=0;for(e=1;e<=f;e++)zc(a,e)!=A&&(n=-q[e],0!=n&&(b++,c[b]=e,d[b]=n));l=new Int32Array(1+f);r=new Float64Array(1+f);for(e=1;e<=g;e++)if(Cc(a,e)!=A){n=m[e];h=gb(a,e,l,r);for(k=1;k<=h;k++)n+=r[k]*q[l[k]];0!=n&&(b++,c[b]=f+e,d[b]=n)}return b};
exports.glp_transform_col=function(a,b,c,d){var e,f,g,k;Ib(a)||x("glp_transform_col: basis factorization does not exist ");f=kb(a);k=new Float64Array(1+f);0<=b&&b<=f||x("glp_transform_col: len = "+b+"; invalid column length");for(g=1;g<=b;g++)e=c[g],1<=e&&e<=f||x("glp_transform_col: ind["+g+"] = "+e+"; row index out of range"),0==d[g]&&x("glp_transform_col: val["+g+"] = 0; zero coefficient not allowed"),0!=k[e]&&x("glp_transform_col: ind["+g+"] = "+e+"; duplicate row indices not allowed"),k[e]=d[g];
xd(a,k);b=0;for(e=1;e<=f;e++)0!=k[e]&&(b++,c[b]=td(a,e),d[b]=k[e]);return b};
var Ed=exports.glp_prim_rtest=function(a,b,c,d,e,f){var g,k,h,l,n,m,q,r,p,u,v,H,E;tc(a)!=ec&&x("glp_prim_rtest: basic solution is not primal feasible ");1!=e&&-1!=e&&x("glp_prim_rtest: dir = "+e+"; invalid parameter");0<f&&1>f||x("glp_prim_rtest: eps = "+f+"; invalid parameter");k=kb(a);h=lb(a);l=0;E=t;r=0;for(n=1;n<=b;n++)if(g=c[n],1<=g&&g<=k+h||x("glp_prim_rtest: ind["+n+"] = "+g+"; variable number out of range"),g<=k?(m=pb(a,g),u=qb(a,g),v=rb(a,g),q=zc(a,g),p=Ac(a,g)):(m=sb(a,g-k),u=tb(a,g-k),
v=ub(a,g-k),q=Cc(a,g-k),p=Dc(a,g-k)),q!=A&&x("glp_prim_rtest: ind["+n+"] = "+g+"; non-basic variable not allowed"),g=0<e?+d[n]:-d[n],m!=Ka){if(m==Sa){if(g>-f)continue;H=(u-p)/g}else if(m==Ta){if(g<+f)continue;H=(v-p)/g}else if(m==Q)if(0>g){if(g>-f)continue;H=(u-p)/g}else{if(g<+f)continue;H=(v-p)/g}else if(m==C){if(-f<g&&g<+f)continue;H=0}0>H&&(H=0);if(E>H||E==H&&r<Math.abs(g))l=n,E=H,r=Math.abs(g)}return l},Fd=exports.glp_dual_rtest=function(a,b,c,d,e,f){var g,k,h,l,n,m,q,r,p,u,v;uc(a)!=ec&&x("glp_dual_rtest: basic solution is not dual feasible");
1!=e&&-1!=e&&x("glp_dual_rtest: dir = "+e+"; invalid parameter");0<f&&1>f||x("glp_dual_rtest: eps = "+f+"; invalid parameter");k=kb(a);h=lb(a);p=jb(a)==za?1:-1;l=0;v=t;q=0;for(n=1;n<=b;n++){g=c[n];1<=g&&g<=k+h||x("glp_dual_rtest: ind["+n+"] = "+g+"; variable number out of range");g<=k?(m=zc(a,g),r=Bc(a,g)):(m=Cc(a,g-k),r=Ec(a,g-k));m==A&&x("glp_dual_rtest: ind["+n+"] = "+g+"; basic variable not allowed");g=0<e?+d[n]:-d[n];if(m==M){if(g<+f)continue;u=p*r/g}else if(m==P){if(g>-f)continue;u=p*r/g}else if(m==
Ra){if(-f<g&&g<+f)continue;u=0}else if(m==Na)continue;0>u&&(u=0);if(v>u||v==u&&q<Math.abs(g))l=n,v=u,q=Math.abs(g)}return l};
function Gd(a,b,c,d,e,f,g){var k,h,l,n=0,m,q;a.ra==Aa&&x("glp_analyze_row: primal basic solution components are undefined");a.wa!=ec&&x("glp_analyze_row: basic solution is not dual feasible");0<=b&&b<=a.n||x("glp_analyze_row: len = "+b+"; invalid row length");q=0;for(k=1;k<=b;k++)h=c[k],1<=h&&h<=a.h+a.n||x("glp_analyze_row: ind["+k+"] = "+h+"; row/column index out of range"),h<=a.h?(a.o[h].stat==A&&x("glp_analyze_row: ind["+k+"] = "+h+"; basic auxiliary variable is not allowed"),m=a.o[h].w):(a.g[h-
a.h].stat==A&&x("glp_analyze_row: ind["+k+"] = "+h+"; basic structural variable is not allowed"),m=a.g[h-a.h].w),q+=d[k]*m;if(e==Sa){if(q>=f)return 1;l=1}else if(e==Ta){if(q<=f)return 1;l=-1}else x("glp_analyze_row: type = "+e+"; invalid parameter");e=f-q;b=Fd(a,b,c,d,l,1E-9);if(0==b)return 2;h=c[b];m=h<=a.h?a.o[h].w:a.g[h-a.h].w;c=e/d[b];g(b,m,c,q,e,h<=a.h?a.o[h].M*c:a.g[h-a.h].M*c);return n}
exports.glp_analyze_bound=function(a,b,c){var d,e,f,g,k,h,l,n,m,q,r,p,u,v;r=p=u=v=null;null!=a&&3621377730==a.Ad||x("glp_analyze_bound: P = "+a+"; invalid problem object");e=a.h;f=a.n;a.ra==ec&&a.wa==ec||x("glp_analyze_bound: optimal basic solution required");0==e||a.valid||x("glp_analyze_bound: basis factorization required");1<=b&&b<=e+f||x("glp_analyze_bound: k = "+b+"; variable number out of range");d=b<=e?a.o[b]:a.g[b-e];g=d.stat;f=d.w;g==A&&x("glp_analyze_bound: k = "+b+"; basic variable not allowed ");
g=new Int32Array(1+e);q=new Float64Array(1+e);h=Cd(a,b,g,q);for(b=-1;1>=b;b+=2)l=Ed(a,h,g,q,b,1E-9),0==l?(k=0,l=0>b?-t:+t):(k=g[l],k<=e?(d=a.o[k],n=qb(a,d.ia),m=rb(a,d.ia)):(d=a.g[k-e],n=tb(a,d.H),m=ub(a,d.H)),d=d.w,d=0>b&&0<q[l]||0<b&&0>q[l]?n-d:m-d,l=f+d/q[l]),0>b?(r=l,p=k):(u=l,v=k);c(r,p,u,v)};
exports.glp_analyze_coef=function(a,b,c){var d,e,f,g,k,h,l,n,m,q,r,p,u,v,H,E,B,J,R,T,O=null,S=null,G=null,Z=null,Y=null,ba=null;null!=a&&3621377730==a.Ad||x("glp_analyze_coef: P = "+a+"; invalid problem object");e=a.h;f=a.n;a.ra==ec&&a.wa==ec||x("glp_analyze_coef: optimal basic solution required");0==e||a.valid||x("glp_analyze_coef: basis factorization required");1<=b&&b<=e+f||x("glp_analyze_coef: k = "+b+"; variable number out of range");b<=e?(d=a.o[b],g=d.type,p=d.c,u=d.f,v=0):(d=a.g[b-e],g=d.type,
p=d.c,u=d.f,v=d.B);k=d.stat;H=d.w;k!=A&&x("glp_analyze_coef: k = "+b+"; non-basic variable not allowed");k=new Int32Array(1+e);T=new Float64Array(1+e);r=new Int32Array(1+f);R=new Float64Array(1+f);m=Bd(a,b,r,R);for(f=-1;1>=f;f+=2)a.dir==za?l=-f:a.dir==Ea&&(l=+f),q=Fd(a,m,r,R,l,1E-9),0==q?(E=0>f?-t:+t,h=0,q=H):(h=r[q],d=h<=e?a.o[h]:a.g[h-e],l=d.M,d=-l/R[q],E=v+d,l=0>f&&0<R[q]||0<f&&0>R[q]?1:-1,a.dir==Ea&&(l=-l),n=Cd(a,h,k,T),d=b<=e?a.o[b]:a.g[b-e],d.type=Ka,d.c=d.f=0,n=Ed(a,n,k,T,l,1E-9),d=b<=e?a.o[b]:
a.g[b-e],d.type=g,d.c=p,d.f=u,0==n?q=0>l&&0<R[q]||0<l&&0>R[q]?-t:+t:(d=k[n],d<=e?(d=a.o[d],B=qb(a,d.ia),J=rb(a,d.ia)):(d=a.g[d-e],B=tb(a,d.H),J=ub(a,d.H)),d=d.w,d=0>l&&0<T[n]||0<l&&0>T[n]?B-d:J-d,q=H+R[q]/T[n]*d)),0>f?(O=E,S=h,G=q):(Z=E,Y=h,ba=q);c(O,S,G,Z,Y,ba)};exports.glp_ios_reason=function(a){return a.reason};exports.glp_ios_get_prob=function(a){return a.F};function Hd(a){a.reason!=Ia&&x("glp_ios_pool_size: operation not allowed");return a.local.size}
function Id(a,b,c,d,e,f,g){a.reason!=Ia&&x("glp_ios_add_row: operation not allowed");var k=a.local,h,l;h={name:null};0<=b&&255>=b||x("glp_ios_add_row: klass = "+b+"; invalid cut class");h.qc=b;h.l=null;0<=c&&c<=a.n||x("glp_ios_add_row: len = "+c+"; invalid cut length");for(l=1;l<=c;l++)b={},1<=d[l]&&d[l]<=a.n||x("glp_ios_add_row: ind["+l+"] = "+d[l]+"; column index out of range"),b.H=d[l],b.j=e[l],b.next=h.l,h.l=b;f!=Sa&&f!=Ta&&f!=C&&x("glp_ios_add_row: type = "+f+"; invalid cut type");h.type=f;h.Zf=
g;h.ga=k.$a;h.next=null;null==h.ga?k.head=h:h.ga.next=h;k.$a=h;k.size++}function Jd(a,b){1<=b&&b<=a.F.n||x("glp_ios_can_branch: j = "+b+"; column number out of range");return a.$c[b]}
function Kd(a,b){var c=a.F,d=a.wc,e=a.n,f,g;g=c.la;for(f=1;f<=e;f++){var k=c.g[f];if(k.kind==Fc&&b[f]!=Math.floor(b[f]))return 1;g+=k.B*b[f]}if(c.Da==ec)switch(c.dir){case za:if(g>=a.F.xa)return 1;break;case Ea:if(g<=a.F.xa)return 1}a.u.s>=fc&&y("Solution found by heuristic: "+g+"");c.Da=ec;c.xa=g;for(f=1;f<=e;f++)c.g[f].Va=b[f];for(e=1;e<=d;e++)for(f=c.o[e],f.Va=0,g=f.l;null!=g;g=g.G)f.Va+=g.j*g.g.Va;return 0}exports.glp_mpl_alloc_wksp=function(){return Ld()};
exports._glp_mpl_init_rand=function(a,b){0!=a.I&&x("glp_mpl_init_rand: invalid call sequence\n");Md(a.Fd,b)};var Od=exports.glp_mpl_read_model=function(a,b,c,d){0!=a.I&&x("glp_mpl_read_model: invalid call sequence");a=Nd(a,b,c,d);1==a||2==a?a=0:4==a&&(a=1);return a};exports.glp_mpl_read_model_from_string=function(a,b,c,d){var e=0;return Od(a,b,function(){return e<c.length?c[e++]:-1},d)};
var Qd=exports.glp_mpl_read_data=function(a,b,c){1!=a.I&&2!=a.I&&x("glp_mpl_read_data: invalid call sequence");a=Pd(a,b,c);2==a?a=0:4==a&&(a=1);return a};exports.glp_mpl_read_data_from_string=function(a,b,c){var d=0;return Qd(a,b,function(){return d<c.length?c[d++]:-1})};exports.glp_mpl_generate=function(a,b,c,d){1!=a.I&&2!=a.I&&x("glp_mpl_generate: invalid call sequence\n");a=Rd(a,b,c,d);3==a?a=0:4==a&&(a=1);return a};
exports.glp_mpl_build_prob=function(a,b){var c,d,e,f,g,k,h;3!=a.I&&x("glp_mpl_build_prob: invalid call sequence\n");db(b);Ca(b,Sd(a));c=Td(a);0<c&&La(b,c);for(d=1;d<=c;d++){Pa(b,d,Ud(a,d));g=Vd(a,d,function(a,b){k=a;h=b});switch(g){case Wd:g=Ka;break;case Xd:g=Sa;break;case Yd:g=Ta;break;case Zd:g=Q;break;case $d:g=C}g==Q&&Math.abs(k-h)<1E-9*(1+Math.abs(k))&&(g=C,Math.abs(k)<=Math.abs(h)?h=k:k=h);Ua(b,d,g,k,h);0!=ae(a,d)&&y("glp_mpl_build_prob: row "+Ud(a,d)+"; constant term "+ae(a,d)+" ignored")}d=
be(a);0<d&&Oa(b,d);for(e=1;e<=d;e++){Qa(b,e,ce(a,e));f=de(a,e);switch(f){case ee:case fe:Hc(b,e,Fc)}g=ge(a,e,function(a,b){k=a;h=b});switch(g){case Wd:g=Ka;break;case Xd:g=Sa;break;case Yd:g=Ta;break;case Zd:g=Q;break;case $d:g=C}if(f==fe){if(g==Ka||g==Ta||0>k)k=0;if(g==Ka||g==Sa||1<h)h=1;g=Q}g==Q&&Math.abs(k-h)<1E-9*(1+Math.abs(k))&&(g=C,Math.abs(k)<=Math.abs(h)?h=k:k=h);Va(b,e,g,k,h)}g=new Int32Array(1+d);e=new Float64Array(1+d);for(d=1;d<=c;d++)f=he(a,d,g,e),Ya(b,d,f,g,e);for(d=1;d<=c;d++)if(f=
ie(a,d),f==je||f==ke){Da(b,Ud(a,d));Fa(b,f==je?za:Ea);Xa(b,0,ae(a,d));f=he(a,d,g,e);for(c=1;c<=f;c++)Xa(b,g[c],e[c]);break}};
exports.glp_mpl_postsolve=function(a,b,c){var d,e,f,g,k,h;(3!=a.I||a.Kf)&&x("glp_mpl_postsolve: invalid call sequence");c!=$b&&c!=le&&c!=Sc&&x("glp_mpl_postsolve: sol = "+c+"; invalid parameter");e=Td(a);f=be(a);e==kb(b)&&f==lb(b)||x("glp_mpl_postsolve: wrong problem object\n");if(!me(a))return 0;for(d=1;d<=e;d++)c==$b?(g=zc(b,d),k=Ac(b,d),h=Bc(b,d)):c==le?(g=0,k=glp_ipt_row_prim(b,d),h=glp_ipt_row_dual(b,d)):c==Sc&&(g=0,k=kd(b,d),h=0),1E-9>Math.abs(k)&&(k=0),1E-9>Math.abs(h)&&(h=0),ne(a,d,g,k,h);
for(d=1;d<=f;d++)c==$b?(g=Cc(b,d),k=Dc(b,d),h=Ec(b,d)):c==le?(g=0,k=glp_ipt_col_prim(b,d),h=glp_ipt_col_dual(b,d)):c==Sc&&(g=0,k=ld(b,d),h=0),1E-9>Math.abs(k)&&(k=0),1E-9>Math.abs(h)&&(h=0),oe(a,d,g,k,h);a=pe(a);3==a?a=0:4==a&&(a=1);return a};
function qe(a,b){var c,d,e;c=null;for(d=a.root;null!=d;)c=d,0>=a.ug(a.info,b,c.key)?(e=0,d=c.left,c.ta++):(e=1,d=c.right);d={};d.key=b;d.type=0;d.link=null;d.ta=1;d.V=c;d.fa=null==c?0:e;d.Aa=0;d.left=null;d.right=null;a.size++;for(null==c?a.root=d:0==e?c.left=d:c.right=d;null!=c;){if(0==e){if(0<c.Aa){c.Aa=0;break}if(0>c.Aa){re(a,c);break}c.Aa=-1}else{if(0>c.Aa){c.Aa=0;break}if(0<c.Aa){re(a,c);break}c.Aa=1}e=c.fa;c=c.V}null==c&&a.height++;return d}
function re(a,b){var c,d,e,f,g;0>b.Aa?(c=b.V,d=b.left,e=d.right,0>=d.Aa?(null==c?a.root=d:0==b.fa?c.left=d:c.right=d,b.ta-=d.ta,d.V=c,d.fa=b.fa,d.Aa++,d.right=b,b.V=d,b.fa=1,b.Aa=-d.Aa,b.left=e,null!=e&&(e.V=b,e.fa=0)):(f=e.left,g=e.right,null==c?a.root=e:0==b.fa?c.left=e:c.right=e,b.ta-=d.ta+e.ta,e.ta+=d.ta,b.Aa=0<=e.Aa?0:1,d.Aa=0>=e.Aa?0:-1,e.V=c,e.fa=b.fa,e.Aa=0,e.left=d,e.right=b,b.V=e,b.fa=1,b.left=g,d.V=e,d.fa=0,d.right=f,null!=f&&(f.V=d,f.fa=1),null!=g&&(g.V=b,g.fa=0))):(c=b.V,d=b.right,e=
d.left,0<=d.Aa?(null==c?a.root=d:0==b.fa?c.left=d:c.right=d,d.ta+=b.ta,d.V=c,d.fa=b.fa,d.Aa--,d.left=b,b.V=d,b.fa=0,b.Aa=-d.Aa,b.right=e,null!=e&&(e.V=b,e.fa=1)):(f=e.left,g=e.right,null==c?a.root=e:0==b.fa?c.left=e:c.right=e,d.ta-=e.ta,e.ta+=b.ta,b.Aa=0>=e.Aa?0:-1,d.Aa=0<=e.Aa?0:1,e.V=c,e.fa=b.fa,e.Aa=0,e.left=b,e.right=d,b.V=e,b.fa=0,b.right=f,d.V=e,d.fa=1,d.left=g,null!=f&&(f.V=b,f.fa=1),null!=g&&(g.V=d,g.fa=0)))}var pd=1,qd=2,se=3,te=4,ue=5;
function od(a,b,c,d){var e,f;f=a.valid=0;switch(a.type){case md:a.bb=null;null==a.jb&&(f={},f.kb=f.h=0,f.valid=0,f.ma=ve(),f.Yd=50,f.Rb=0,f.Xe=f.Ze=f.Ye=null,f.ge=f.fe=null,f.qg=null,f.rg=null,f.jc=1E-6,f.Xf=0,a.jb=f,f=1);break;case rd:case sd:a.jb=null,null==a.bb&&(we&&y("lpf_create_it: warning: debug mode enabled"),f={valid:0},f.Mc=f.cf=0,f.ma=ve(),f.h=0,f.yf=null,f.N=50,f.n=0,f.Ld=f.Kd=null,f.Nd=f.Md=null,f.Pc=null,f.Ee=f.De=null,f.Ge=f.Fe=null,f.Id=1E3,f.md=0,f.Zb=null,f.$b=null,f.mb=f.Gc=null,
a.bb=f,f=1)}null!=a.jb?e=a.jb.ma:null!=a.bb&&(e=a.bb.ma);f&&(e.Ya=a.zd);e.ec=a.ec;e.xc=a.xc;e.hc=a.hc;e.Ob=a.Ob;e.sc=a.sc;null!=a.jb&&(f&&(a.jb.Yd=a.Zc),a.jb.jc=a.jc);null!=a.bb&&(f&&(a.bb.N=a.vc),f&&(a.bb.Id=a.jd));if(null!=a.jb){a:{e=a.jb;1>b&&x("fhv_factorize: m = "+b+"; invalid parameter");1E8<b&&x("fhv_factorize: m = "+b+"; matrix too big");e.h=b;e.valid=0;null==e.Xe&&(e.Xe=new Int32Array(1+e.Yd));null==e.Ze&&(e.Ze=new Int32Array(1+e.Yd));null==e.Ye&&(e.Ye=new Int32Array(1+e.Yd));e.kb<b&&(e.kb=
b+100,e.ge=new Int32Array(1+e.kb),e.fe=new Int32Array(1+e.kb),e.qg=new Int32Array(1+e.kb),e.rg=new Float64Array(1+e.kb));switch(xe(e.ma,b,c,d)){case ye:b=ze;break a;case Ae:b=Be;break a}e.valid=1;e.Rb=0;ha(e.ge,1,e.ma.nb,1,b);ha(e.fe,1,e.ma.xb,1,b);b=e.Xf=0}switch(b){case ze:return a=pd;case Be:return a=qd}}else if(null!=a.bb){a:{e=a.bb;if(we)var g,k,h,l,n,m;1>b&&x("lpf_factorize: m = "+b+"; invalid parameter");1E8<b&&x("lpf_factorize: m = "+b+"; matrix too big");e.cf=e.h=b;e.valid=0;null==e.Ld&&
(e.Ld=new Int32Array(1+e.N));null==e.Kd&&(e.Kd=new Int32Array(1+e.N));null==e.Nd&&(e.Nd=new Int32Array(1+e.N));null==e.Md&&(e.Md=new Int32Array(1+e.N));null==e.Pc&&(f=e.N,Ce&&y("scf_create_it: warning: debug mode enabled"),1<=f&&32767>=f||x("scf_create_it: n_max = "+f+"; invalid parameter"),g={},g.N=f,g.n=0,g.Pb=new Float64Array(1+f*f),g.C=new Float64Array(1+f*(f+1)/2),g.p=new Int32Array(1+f),g.bg=De,g.ta=0,Ce?g.m=new Float64Array(1+f*f):g.m=null,g.eg=new Float64Array(1+f),e.Pc=g);null==e.Zb&&(e.Zb=
new Int32Array(1+e.Id));null==e.$b&&(e.$b=new Float64Array(1+e.Id));e.Mc<b&&(e.Mc=b+100,e.Ee=new Int32Array(1+e.Mc+e.N),e.De=new Int32Array(1+e.Mc+e.N),e.Ge=new Int32Array(1+e.Mc+e.N),e.Fe=new Int32Array(1+e.Mc+e.N),e.mb=new Float64Array(1+e.Mc+e.N),e.Gc=new Float64Array(1+e.Mc+e.N));switch(xe(e.ma,b,c,d)){case ye:b=Ee;break a;case Ae:b=LPF_ECOND;break a}e.valid=1;if(we){e.yf=n=new Float64Array(1+b*b);l=new Int32Array(1+b);m=new Float64Array(1+b);for(f=1;f<=b*b;f++)n[f]=0;for(k=1;k<=b;k++)for(h=c(d,
k,l,m),f=1;f<=h;f++)g=l[f],n[(g-1)*b+k]=m[f]}e.n=0;c=e.Pc;c.n=c.ta=0;for(f=1;f<=b;f++)e.Ee[f]=e.De[f]=f,e.Ge[f]=e.Fe[f]=f;e.md=1;b=0}switch(b){case 0:switch(a.type){case rd:a.bb.Pc.bg=De;break;case sd:a.bb.Pc.bg=Fe}break;case Ee:return a=pd;case LPF_ECOND:return a=qd}}a.valid=1;return a.dg=0}
function wd(a,b){if(null!=a.jb){var c=a.jb,d=c.ma.nb,e=c.ma.xb,f=c.ge,g=c.fe;c.valid||x("fhv_ftran: the factorization is not valid");c.ma.nb=f;c.ma.xb=g;Ge(c.ma,0,b);c.ma.nb=d;c.ma.xb=e;He(c,0,b);Ie(c.ma,0,b)}else if(null!=a.bb){var c=a.bb,d=c.cf,e=c.h,k=c.n,h=c.De,f=c.Fe,g=c.mb,l,n;if(we)var m;c.valid||x("lpf_ftran: the factorization is not valid");if(we)for(m=new Float64Array(1+e),l=1;l<=e;l++)m[l]=b[l];for(l=1;l<=d+k;l++)g[l]=(n=h[l])<=e?b[n]:0;Ge(c.ma,0,g);Je(c,g,d,g);Ke(c.Pc,0,g,d);k=c.n;h=c.Ld;
l=c.Kd;n=c.Zb;var q=c.$b,r,p,u,v;for(r=1;r<=k;r++)if(0!=g[r+d])for(v=-1*g[r+d],p=h[r],u=p+l[r];p<u;p++)g[n[p]]+=v*q[p];Ie(c.ma,0,g);for(l=1;l<=e;l++)b[l]=g[f[l]];we&&check_error(c,0,b,m)}}
function yd(a,b){if(null!=a.jb){var c=a.jb,d=c.ma.nb,e=c.ma.xb,f=c.ge,g=c.fe;c.valid||x("fhv_btran: the factorization is not valid");Ie(c.ma,1,b);He(c,1,b);c.ma.nb=f;c.ma.xb=g;Ge(c.ma,1,b);c.ma.nb=d;c.ma.xb=e}else if(null!=a.bb){var c=a.bb,d=c.cf,e=c.h,k=c.n,f=c.Ee,h=c.Ge,g=c.mb,l,n;if(we)var m;c.valid||x("lpf_btran: the factorization is not valid");if(we)for(m=new Float64Array(1+e),l=1;l<=e;l++)m[l]=b[l];for(l=1;l<=d+k;l++)g[l]=(n=h[l])<=e?b[n]:0;Ie(c.ma,1,g);Le(c,g,d,g);Ke(c.Pc,1,g,d);k=c.n;h=c.Nd;
l=c.Md;n=c.Zb;var q=c.$b,r,p,u,v;for(r=1;r<=k;r++)if(0!=g[r+d])for(v=-1*g[r+d],p=h[r],u=p+l[r];p<u;p++)g[n[p]]+=v*q[p];Ge(c.ma,1,g);for(l=1;l<=e;l++)b[l]=g[f[l]];we&&check_error(c,1,b,m)}}
function Me(a,b,c,d,e,f){if(null!=a.jb)switch(Ne(a.jb,b,c,d,e,f)){case ze:return a.valid=0,a=pd;case Oe:return a.valid=0,a=se;case Pe:return a.valid=0,a=te;case Qe:return a.valid=0,a=ue}else if(null!=a.bb){a:{var g=a.bb,k=g.cf,h=g.h;if(we)var l=g.yf;var n=g.n,m=g.Ld,q=g.Kd,r=g.Nd,p=g.Md,u=g.Ee,v=g.De,H=g.Ge,E=g.Fe,B=g.md,J=g.Zb,R=g.$b,T=g.Gc,O=g.mb,S=g.Gc,G,Z,Y;g.valid||x("lpf_update_it: the factorization is not valid");1<=b&&b<=h||x("lpf_update_it: j = "+b+"; column number out of range");if(n==g.N)g.valid=
0,b=LPF_ELIMIT;else{for(G=1;G<=h;G++)T[G]=0;for(Y=1;Y<=c;Y++)G=d[e+Y],1<=G&&G<=h||x("lpf_update_it: ind["+Y+"] = "+G+"; row number out of range"),0!=T[G]&&x("lpf_update_it: ind["+Y+"] = "+G+"; duplicate row index not allowed"),0==f[Y]&&x("lpf_update_it: val["+Y+"] = "+f[Y]+"; zero element not allowed"),T[G]=f[Y];if(we)for(G=1;G<=h;G++)l[(G-1)*h+b]=T[G];for(G=1;G<=k+n;G++)O[G]=(Z=v[G])<=h?T[Z]:0;for(G=1;G<=k+n;G++)S[G]=0;S[E[b]]=1;Ge(g.ma,0,O);Ie(g.ma,1,S);if(g.Id<B+k+k){G=g.Id;c=g.md-1;d=g.Zb;for(e=
g.$b;G<B+k+k;)G+=G;g.Id=G;g.Zb=new Int32Array(1+G);g.$b=new Float64Array(1+G);ha(g.Zb,1,d,1,c);ha(g.$b,1,e,1,c);J=g.Zb;R=g.$b}m[n+1]=B;for(G=1;G<=k;G++)0!=O[G]&&(J[B]=G,R[B]=O[G],B++);q[n+1]=B-g.md;g.md=B;r[n+1]=B;for(G=1;G<=k;G++)0!=S[G]&&(J[B]=G,R[B]=S[G],B++);p[n+1]=B-g.md;g.md=B;Je(g,O,0,O);Le(g,S,0,S);q=0;for(G=1;G<=k;G++)q-=S[G]*O[G];m=g.Pc;B=q;G=m.N;q=m.n;c=m.Pb;d=m.C;e=m.p;if(Ce)var ba=m.m;p=m.eg;r=0;if(q==G)r=Re;else{m.n=++q;f=1;for(h=(f-1)*m.N+q;f<q;f++,h+=G)c[h]=0;h=1;for(f=(q-1)*m.N+h;h<
q;h++,f++)c[f]=0;for(f=c[(q-1)*m.N+q]=1;f<q;f++){J=0;h=1;for(l=(f-1)*m.N+1;h<q;h++,l++)J+=c[l]*O[h+k];d[Se(m,f,q)]=J}for(h=1;h<q;h++)p[h]=S[e[h]+k];p[q]=B;e[q]=q;if(Ce){f=1;for(h=(f-1)*m.N+q;f<q;f++,h+=G)ba[h]=O[f+k];h=1;for(f=(q-1)*m.N+h;h<q;h++,f++)ba[f]=S[h+k];ba[(q-1)*m.N+q]=B}for(O=1;O<q&&0==p[O];O++);switch(m.bg){case De:S=m.n;ba=m.Pb;for(B=m.C;O<S;O++){e=Se(m,O,O);c=(O-1)*m.N+1;f=(S-1)*m.N+1;if(Math.abs(B[e])<Math.abs(p[O])){G=O;for(d=e;G<=S;G++,d++)l=B[d],B[d]=p[G],p[G]=l;G=1;d=c;for(h=f;G<=
S;G++,d++,h++)l=ba[d],ba[d]=ba[h],ba[h]=l}Math.abs(B[e])<Te&&(B[e]=p[O]=0);if(0!=p[O]){l=p[O]/B[e];G=O+1;for(d=e+1;G<=S;G++,d++)p[G]-=l*B[d];G=1;d=c;for(h=f;G<=S;G++,d++,h++)ba[h]-=l*ba[d]}}Math.abs(p[S])<Te&&(p[S]=0);B[Se(m,S,S)]=p[S];break;case Fe:Ue(m,O,p)}G=m.N;O=m.n;S=m.C;B=0;ba=1;for(p=Se(m,ba,ba);ba<=O;ba++,p+=G,G--)0!=S[p]&&B++;m.ta=B;m.ta!=q&&(r=Ve);Ce&&check_error(m,"scf_update_exp")}switch(r){case Ve:g.valid=0;b=Ee;break a}u[k+n+1]=v[k+n+1]=k+n+1;H[k+n+1]=E[k+n+1]=k+n+1;G=E[b];Z=E[k+n+
1];H[G]=k+n+1;E[k+n+1]=G;H[Z]=b;E[b]=Z;g.n++;b=0}}switch(b){case Ee:return a.valid=0,a=pd;case LPF_ELIMIT:return a.valid=0,a=te}}a.dg++;return 0}
var We=exports.glp_read_lp=function(a,b,c){function d(a,b){throw Error(a.count+": "+b);}function e(a,b){y(a.count+": warning: "+b)}function f(a){var b;"\n"==a.m&&a.count++;b=a.Lg();0>b?"\n"==a.m?(a.count--,b=-1):(e(a,"missing final end of line"),b="\n"):"\n"!=b&&(0<=" \t\n\v\f\r".indexOf(b)?b=" ":ta(b)&&d(a,"invalid control character "+b.charCodeAt(0)));a.m=b}function g(a){a.i+=a.m;f(a)}function k(a,b){return a.toLowerCase()==b.toLowerCase()?1:0}function h(a){function b(){for(a.b=9;va(a.m)||0<="!\"#$%&()/,.;?@_`'{}|~".indexOf(a.m);)g(a);
c&&(k(a.i,"minimize")?a.b=1:k(a.i,"minimum")?a.b=1:k(a.i,"min")?a.b=1:k(a.i,"maximize")?a.b=2:k(a.i,"maximum")?a.b=2:k(a.i,"max")?a.b=2:k(a.i,"subject")?" "==a.m&&(f(a),"t"==a.m.toLowerCase()&&(a.b=3,a.i+=" ",g(a),"o"!=a.m.toLowerCase()&&d(a,"keyword `subject to' incomplete"),g(a),ua(a.m)&&d(a,"keyword `"+a.i+a.m+"...' not recognized"))):k(a.i,"such")?" "==a.m&&(f(a),"t"==a.m.toLowerCase()&&(a.b=3,a.i+=" ",g(a),"h"!=a.m.toLowerCase()&&d(a,"keyword `such that' incomplete"),g(a),"a"!=a.m.toLowerCase()&&
d(a,"keyword `such that' incomplete"),g(a),"t"!=a.m.toLowerCase()&&d(a,"keyword `such that' incomplete"),g(a),ua(a.m)&&d(a,"keyword `"+a.i+a.m+"...' not recognized"))):k(a.i,"st")?a.b=3:k(a.i,"s.t.")?a.b=3:k(a.i,"st.")?a.b=3:k(a.i,"bounds")?a.b=4:k(a.i,"bound")?a.b=4:k(a.i,"general")?a.b=5:k(a.i,"generals")?a.b=5:k(a.i,"gen")?a.b=5:k(a.i,"integer")?a.b=6:k(a.i,"integers")?a.b=6:k(a.i,"int")?a.b=6:k(a.i,"binary")?a.b=7:k(a.i,"binaries")?a.b=7:k(a.i,"bin")?a.b=7:k(a.i,"end")&&(a.b=8))}var c;a.b=-1;
a.i="";for(a.value=0;;){for(c=0;" "==a.m;)f(a);if(-1==a.m)a.b=0;else if("\n"==a.m)if(f(a),ua(a.m))c=1,b();else continue;else if("\\"==a.m){for(;"\n"!=a.m;)f(a);continue}else if(ua(a.m)||"."!=a.m&&0<="!\"#$%&()/,.;?@_`'{}|~".indexOf(a.m))b();else if(wa(a.m)||"."==a.m){for(a.b=10;wa(a.m);)g(a);if("."==a.m)for(g(a),1!=a.i.length||wa(a.m)||d(a,"invalid use of decimal point");wa(a.m);)g(a);if("e"==a.m||"E"==a.m)for(g(a),"+"!=a.m&&"-"!=a.m||g(a),wa(a.m)||d(a,"numeric constant `"+a.i+"' incomplete");wa(a.m);)g(a);
a.value=Number(a.i);a.value==Number.NaN&&d(a,"numeric constant `"+a.i+"' out of range")}else"+"==a.m?(a.b=11,g(a)):"-"==a.m?(a.b=12,g(a)):":"==a.m?(a.b=13,g(a)):"<"==a.m?(a.b=14,g(a),"="==a.m&&g(a)):">"==a.m?(a.b=15,g(a),"="==a.m&&g(a)):"="==a.m?(a.b=16,g(a),"<"==a.m?(a.b=14,g(a)):">"==a.m&&(a.b=15,g(a))):d(a,"character `"+a.m+"' not recognized");break}for(;" "==a.m;)f(a)}function l(a,b){var c=yb(a.Oa,b);if(0==c){c=Oa(a.Oa,1);Qa(a.Oa,c,b);if(a.N<c){var d=a.N,e=a.ca,f=a.j,g=a.fa,k=a.c,h=a.f;a.N+=a.N;
a.ca=new Int32Array(1+a.N);ha(a.ca,1,e,1,d);a.j=new Float64Array(1+a.N);ha(a.j,1,f,1,d);a.fa=new Int8Array(1+a.N);ja(a.fa,1,0,a.N);ha(a.fa,1,g,1,d);a.c=new Float64Array(1+a.N);ha(a.c,1,k,1,d);a.f=new Float64Array(1+a.N);ha(a.f,1,h,1,d)}a.c[c]=+t;a.f[c]=-t}return c}function n(a){for(var b,c=0,e,f;;)if(11==a.b?(e=1,h(a)):12==a.b?(e=-1,h(a)):e=1,10==a.b?(f=a.value,h(a)):f=1,9!=a.b&&d(a,"missing variable name"),b=l(a,a.i),a.fa[b]&&d(a,"multiple use of variable `"+a.i+"' not allowed"),c++,a.ca[c]=b,a.j[c]=
e*f,a.fa[b]=1,h(a),11!=a.b&&12!=a.b){for(b=1;b<=c;b++)a.fa[a.ca[b]]=0;e=0;for(b=1;b<=c;b++)0!=a.j[b]&&(e++,a.ca[e]=a.ca[b],a.j[e]=a.j[b]);break}return e}function m(a,b,c){a.c[b]!=+t&&e(a,"lower bound of variable `"+nb(a.Oa,b)+"' redefined");a.c[b]=c}function q(a,b,c){a.f[b]!=-t&&e(a,"upper bound of variable `"+nb(a.Oa,b)+"' redefined");a.f[b]=c}function r(a){var b,c,e,f;for(h(a);11==a.b||12==a.b||10==a.b||9==a.b;)11==a.b||12==a.b?(c=1,f=11==a.b?1:-1,h(a),10==a.b?(e=f*a.value,h(a)):k(a.i,"infinity")||
k(a.i,"inf")?(0<f&&d(a,"invalid use of `+inf' as lower bound"),e=-t,h(a)):d(a,"missing lower bound")):10==a.b?(c=1,e=a.value,h(a)):c=0,c&&(14!=a.b&&d(a,"missing `<', `<=', or `=<' after lower bound"),h(a)),9!=a.b&&d(a,"missing variable name"),b=l(a,a.i),c&&m(a,b,e),h(a),14==a.b?(h(a),11==a.b||12==a.b?(f=11==a.b?1:-1,h(a),10==a.b?(q(a,b,f*a.value),h(a)):k(a.i,"infinity")||k(a.i,"inf")?(0>f&&d(a,"invalid use of `-inf' as upper bound"),q(a,b,+t),h(a)):d(a,"missing upper bound")):10==a.b?(q(a,b,a.value),
h(a)):d(a,"missing upper bound")):15==a.b?(c&&d(a,"invalid bound definition"),h(a),11==a.b||12==a.b?(f=11==a.b?1:-1,h(a),10==a.b?(m(a,b,f*a.value),h(a)):k(a.i,"infinity")||0==k(a.i,"inf")?(0<f&&d(a,"invalid use of `+inf' as lower bound"),m(a,b,-t),h(a)):d(a,"missing lower bound")):10==a.b?(m(a,b,a.value),h(a)):d(a,"missing lower bound")):16==a.b?(c&&d(a,"invalid bound definition"),h(a),11==a.b||12==a.b?(f=11==a.b?1:-1,h(a),10==a.b?(m(a,b,f*a.value),q(a,b,f*a.value),h(a)):d(a,"missing fixed value")):
10==a.b?(m(a,b,a.value),q(a,b,a.value),h(a)):d(a,"missing fixed value")):k(a.i,"free")?(c&&d(a,"invalid bound definition"),m(a,b,-t),q(a,b,+t),h(a)):c||d(a,"invalid bound definition")}function p(a){var b,c;5==a.b?(c=0,h(a)):6==a.b?(c=0,h(a)):7==a.b&&(c=1,h(a));for(;9==a.b;)b=l(a,a.i),Hc(a.Oa,b,Fc),c&&(m(a,b,0),q(a,b,1)),h(a)}var u={};y("Reading problem data");null==b&&(b={});u.Oa=a;u.u=b;u.Lg=c;u.count=0;u.m="\n";u.b=0;u.i="";u.value=0;u.N=100;u.ca=new Int32Array(1+u.N);u.j=new Float64Array(1+u.N);
u.fa=new Int8Array(1+u.N);ja(u.fa,1,0,u.N);u.c=new Float64Array(1+u.N);u.f=new Float64Array(1+u.N);db(a);wb(a);h(u);1!=u.b&&2!=u.b&&d(u,"`minimize' or `maximize' keyword missing");(function(a){var b,c;1==a.b?Fa(a.Oa,za):2==a.b&&Fa(a.Oa,Ea);h(a);9==a.b&&":"==a.m?(Da(a.Oa,a.i),h(a),h(a)):Da(a.Oa,"obj");c=n(a);for(b=1;b<=c;b++)Xa(a.Oa,a.ca[b],a.j[b])})(u);3!=u.b&&d(u,"constraints section missing");(function(a){var b,c,e;for(h(a);b=La(a.Oa,1),9==a.b&&":"==a.m?(0!=xb(a.Oa,a.i)&&d(a,"constraint `"+a.i+
"' multiply defined"),Pa(a.Oa,b,a.i),h(a),h(a)):Pa(a.Oa,b,"r."+a.count),c=n(a),Ya(a.Oa,b,c,a.ca,a.j),14==a.b?(e=Ta,h(a)):15==a.b?(e=Sa,h(a)):16==a.b?(e=C,h(a)):d(a,"missing constraint sense"),11==a.b?(c=1,h(a)):12==a.b?(c=-1,h(a)):c=1,10!=a.b&&d(a,"missing right-hand side"),Ua(a.Oa,b,e,c*a.value,c*a.value),"\n"!=a.m&&-1!=a.m&&d(a,"invalid symbol(s) beyond right-hand side"),h(a),11==a.b||12==a.b||10==a.b||9==a.b;);})(u);for(4==u.b&&r(u);5==u.b||6==u.b||7==u.b;)p(u);8==u.b?h(u):0==u.b?e(u,"keyword `end' missing"):
d(u,"symbol "+u.i+" in wrong position");0!=u.b&&d(u,"extra symbol(s) detected beyond `end'");var v,H;for(b=1;b<=a.n;b++)v=u.c[b],H=u.f[b],v==+t&&(v=0),H==-t&&(H=+t),c=v==-t&&H==+t?Ka:H==+t?Sa:v==-t?Ta:v!=H?Q:C,Va(u.Oa,b,c,v,H);y(a.h+" row"+(1==a.h?"":"s")+", "+a.n+" column"+(1==a.n?"":"s")+", "+a.O+" non-zero"+(1==a.O?"":"s"));0<Jc(a)&&(b=Jc(a),c=Kc(a),1==b?0==c?y("One variable is integer"):y("One variable is binary"):(v=b+" integer variables, ",y((0==c?v+"none":1==c?v+"one":c==b?v+"all":v+c)+" of which "+
(1==c?"is":"are")+" binary")));y(u.count+" lines were read");zb(a);$a(a);return 0};
exports.glp_write_lp=function(a,b,c){function d(a){if("."==a[0]||wa(a[0]))return 1;for(var b=0;b<a.length;b++)if(!va(a[b])&&0>"!\"#$%&()/,.;?@_`'{}|~".indexOf(a[b]))return 1;return 0}function e(a){for(var b=0;b<a.length;b++)" "==a[b]?a[b]="_":"-"==a[b]?a[b]="~":"["==a[b]?a[b]="(":"]"==a[b]&&(a[b]=")")}function f(a,b){var c;c=0==b?ib(a.Oa):mb(a.Oa,b);if(null==c)return 0==b?"obj":"r_"+b;e(c);return d(c)?0==b?"obj":"r_"+b:c}function g(a,b){var c=nb(a.Oa,b);if(null==c)return"x_"+b;e(c);return d(c)?"x_"+
b:c}function k(){c("End");r++;y(r+" lines were written");return 0}var h={},l,n,m,q,r,p;y("Writing problem data");null==b&&(b={});h.Oa=a;h.u=b;r=0;c("\\* Problem: "+(null==a.name?"Unknown":a.name)+" *\\");r++;c("");r++;if(!(0<a.h&&0<a.n))return y("Warning: problem has no rows/columns"),c("\\* WARNING: PROBLEM HAS NO ROWS/COLUMNS *\\"),r++,c(""),r++,k();a.dir==za?(c("Minimize"),r++):a.dir==Ea&&(c("Maximize"),r++);b=f(h,0);p=" "+b+":";n=0;for(m=1;m<=a.n;m++)if(l=a.g[m],0!=l.B||null==l.l)n++,b=g(h,m),
q=0==l.B?" + 0 "+b:1==l.B?" + "+b:-1==l.B?" - "+b:0<l.B?" + "+l.B+" "+b:" - "+-l.B+" "+b,72<p.length+q.length&&(c(p),p="",r++),p+=q;0==n&&(q=" 0 "+g(h,1),p+=q);c(p);r++;0!=a.la&&(c("\\* constant term = "+a.la+" *\\"),r++);c("");r++;c("Subject To");r++;for(m=1;m<=a.h;m++)if(l=a.o[m],l.type!=Ka){b=f(h,m);p=" "+b+":";for(n=l.l;null!=n;n=n.G)b=g(h,n.g.H),q=1==n.j?" + "+b:-1==n.j?" - "+b:0<n.j?" + "+n.j+" "+b:" - "+-n.j+" "+b,72<p.length+q.length&&(c(p),p="",r++),p+=q;l.type==Q?(q=" - ~r_"+m,72<p.length+
q.length&&(c(p),p="",r++),p+=q):null==l.l&&(q=" 0 "+g(h,1),p+=q);if(l.type==Sa)q=" >= "+l.c;else if(l.type==Ta)q=" <= "+l.f;else if(l.type==Q||l.type==C)q=" = "+l.c;72<p.length+q.length&&(c(p),p="",r++);p+=q;c(p);r++}c("");r++;q=0;for(m=1;m<=a.h;m++)l=a.o[m],l.type==Q&&(q||(c("Bounds"),q=1,r++),c(" 0 <= ~r_"+m+" <= "+(l.f-l.c)),r++);for(m=1;m<=a.n;m++)if(l=a.g[m],l.type!=Sa||0!=l.c)q||(c("Bounds"),q=1,r++),b=g(h,m),l.type==Ka?(c(" "+b+" free"),r++):l.type==Sa?(c(" "+b+" >= "+l.c),r++):l.type==Ta?
(c(" -Inf <= "+b+" <= "+l.f),r++):l.type==Q?(c(" "+l.c+" <= "+b+" <= "+l.f),r++):l.type==C&&(c(" "+b+" = "+l.c),r++);q&&c("");r++;q=0;for(m=1;m<=a.n;m++)l=a.g[m],l.kind!=Ma&&(q||(c("Generals"),q=1,r++),c(" "+g(h,m)),r++);q&&(c(""),r++);return k()};exports.glp_read_lp_from_string=function(a,b,c){var d=0;return We(a,b,function(){return d<c.length?c[d++]:-1})};var ze=1,Be=2,Oe=3,Pe=4,Qe=5;
function He(a,b,c){var d=a.Rb,e=a.Xe,f=a.Ze,g=a.Ye,k=a.ma.yb,h=a.ma.zb,l,n,m;a.valid||x("fhv_h_solve: the factorization is not valid");if(b)for(b=d;1<=b;b--){if(a=e[b],m=c[a],0!=m)for(l=f[b],n=l+g[b]-1;l<=n;l++)c[k[l]]-=h[l]*m}else for(b=1;b<=d;b++){a=e[b];m=c[a];l=f[b];for(n=l+g[b]-1;l<=n;l++)m-=h[l]*c[k[l]];c[a]=m}}
function Ne(a,b,c,d,e,f){var g=a.h,k=a.ma,h=k.Fc,l=k.Ec,n=k.nd,m=k.wf,q=k.Dc,r=k.Cc,p=k.Qc,u=k.nb,v=k.xb,H=k.of,E=k.ke,B=k.yb,J=k.zb,R=k.xe,T=k.Ob,O=a.Xe,S=a.Ze,G=a.Ye,Z=a.ge,Y=a.fe,ba=a.qg,oa=a.rg,z=a.jc,F,D;a.valid||x("fhv_update_it: the factorization is not valid");1<=b&&b<=g||x("fhv_update_it: j = "+b+"; column number out of range");if(a.Rb==a.Yd)return a.valid=0,a=Pe;for(F=1;F<=g;F++)oa[F]=0;for(D=1;D<=c;D++)F=d[e+D],1<=F&&F<=g||x("fhv_update_it: ind["+D+"] = "+F+"; row number out of range"),
0!=oa[F]&&x("fhv_update_it: ind["+D+"] = "+F+"; duplicate row index not allowed"),0==f[D]&&x("fhv_update_it: val["+D+"] = "+f[D]+"; zero element not allowed"),oa[F]=f[D];a.ma.nb=Z;a.ma.xb=Y;Ge(a.ma,0,oa);a.ma.nb=u;a.ma.xb=v;He(a,0,oa);c=0;for(F=1;F<=g;F++)e=oa[F],0==e||Math.abs(e)<T||(c++,ba[c]=F,oa[c]=e);Y=q[b];for(Z=Y+r[b]-1;Y<=Z;Y++){F=B[Y];f=h[F];for(D=f+l[F]-1;B[f]!=b;f++);B[f]=B[D];J[f]=J[D];l[F]--}k.Sb-=r[b];r[b]=0;e=H[b];d=0;for(D=1;D<=c;D++){F=ba[D];if(l[F]+1>n[F]&&Xe(k,F,l[F]+10))return a.valid=
0,k.Ya=k.Ka+k.Ka,a=Qe;f=h[F]+l[F];B[f]=b;J[f]=oa[D];l[F]++;d<v[F]&&(d=v[F])}if(p[b]<c&&Ye(k,b,c))return a.valid=0,k.Ya=k.Ka+k.Ka,a=Qe;Y=q[b];ha(B,Y,ba,1,c);ha(J,Y,oa,1,c);r[b]=c;k.Sb+=c;if(e>d)return a.valid=0,a=ze;F=u[e];b=E[e];for(D=e;D<d;D++)u[D]=u[D+1],v[u[D]]=D,E[D]=E[D+1],H[E[D]]=D;u[d]=F;v[F]=d;E[d]=b;H[b]=d;for(b=1;b<=g;b++)R[b]=0;f=h[F];for(D=f+l[F]-1;f<=D;f++){b=B[f];R[b]=J[f];Y=q[b];for(Z=Y+r[b]-1;B[Y]!=F;Y++);B[Y]=B[Z];J[Y]=J[Z];r[b]--}k.Sb-=l[F];l[F]=0;a.Rb++;O[a.Rb]=F;G[a.Rb]=0;if(k.Pa-
k.Ja<d-e&&(Ze(k),k.Pa-k.Ja<d-e))return a.valid=k.valid=0,k.Ya=k.Ka+k.Ka,a=Qe;for(D=e;D<d;D++)if(b=u[D],c=E[D],0!=R[c]){v=R[c]/m[b];H=h[b];for(c=H+l[b]-1;H<=c;H++)R[B[H]]-=v*J[H];k.Pa--;B[k.Pa]=b;J[k.Pa]=v;G[a.Rb]++}0==G[a.Rb]?a.Rb--:(S[a.Rb]=k.Pa,a.Xf+=G[a.Rb]);m[F]=R[E[d]];c=0;for(D=d+1;D<=g;D++)if(b=E[D],e=R[b],!(Math.abs(e)<T)){if(r[b]+1>p[b]&&Ye(k,b,r[b]+10))return a.valid=0,k.Ya=k.Ka+k.Ka,a=Qe;Y=q[b]+r[b];B[Y]=F;J[Y]=e;r[b]++;c++;ba[c]=b;oa[c]=e}if(n[F]<c&&Xe(k,F,c))return a.valid=0,k.Ya=k.Ka+
k.Ka,a=Qe;f=h[F];ha(B,f,ba,1,c);ha(J,f,oa,1,c);l[F]=c;k.Sb+=c;e=0;F=u[d];f=h[F];for(D=f+l[F]-1;f<=D;f++)e<Math.abs(J[f])&&(e=Math.abs(J[f]));b=E[d];Y=q[b];for(Z=Y+r[b]-1;Y<=Z;Y++)e<Math.abs(J[Y])&&(e=Math.abs(J[Y]));return Math.abs(m[F])<z*e?(a.valid=0,a=Oe):0}
function ic(a){function b(a,b,c,d,h,l){var n,m,q,r,p,u,v,H,E,B,J,R,T,O,S=0;0<a&&0<b||x("triang: m = "+a+"; n = "+b+"; invalid dimension");n=new Int32Array(1+(a>=b?a:b));m=new Int32Array(1+a);q=new Int32Array(1+b);r=new Int32Array(1+a);p=new Int32Array(1+a);v=new Int32Array(1+b);H=new Int32Array(1+b);for(B=1;B<=b;B++)J=d(c,-B,n),v[B]=m[J],m[J]=B;for(J=u=0;J<=a;J++)for(B=m[J];0!=B;B=v[B])H[B]=u,u=B;J=0;for(B=u;0!=B;B=H[B])v[B]=J,J=B;for(E=1;E<=a;E++)m[E]=J=d(c,+E,n),r[E]=0,p[E]=q[J],0!=p[E]&&(r[p[E]]=
E),q[J]=E;for(E=1;E<=a;E++)h[E]=0;for(B=1;B<=b;B++)l[B]=0;R=1;for(T=b;R<=T;){E=q[1];if(0!=E){B=0;for(O=d(c,+E,n);1<=O;O--)J=n[O],0==l[J]&&(B=J);h[E]=l[B]=R;R++;S++}else B=u,l[B]=T,T--;0==v[B]?u=H[B]:H[v[B]]=H[B];0!=H[B]&&(v[H[B]]=v[B]);for(O=d(c,-B,n);1<=O;O--)E=n[O],J=m[E],0==r[E]?q[J]=p[E]:p[r[E]]=p[E],0!=p[E]&&(r[p[E]]=r[E]),m[E]=--J,r[E]=0,p[E]=q[J],0!=p[E]&&(r[p[E]]=E),q[J]=E}for(E=1;E<=a;E++)0==h[E]&&(h[E]=R++);for(B=1;B<=b;B++);for(r=1;r<=a;r++)m[r]=0;for(E=1;E<=a;E++)r=h[E],m[r]=E;for(J=1;J<=
b;J++)q[J]=0;for(B=1;B<=b;B++)J=l[B],q[J]=B;for(r=1;r<=S;r++)for(E=m[r],O=d(c,+E,n);1<=O;O--);return S}function c(a,b,c){var d=kb(a);lb(a);var h,l,n,m=0;if(0<b){h=+b;n=vb(a,h,c,null);for(b=1;b<=n;b++)$e(a,c[b],function(a){a!=af&&(c[++m]=d+c[b])});bf(a,h,function(a){a!=af&&(c[++m]=h)})}else n=function(b){b!=af&&(l<=d?c[++m]=l:m=gb(a,l-d,c,null))},l=-b,l<=d?bf(a,l,n):$e(a,l-d,n);return m}function d(a){var d=kb(a),g=lb(a),k,h,l,n,m,q,r,p=new Int32Array(1+d+g);y("Constructing initial basis...");if(0==
d||0==g)Hb(a);else{m=new Int32Array(1+d);h=new Int32Array(1+d+g);n=b(d,d+g,a,c,m,h);3<=cf(a)&&y("Size of triangular part = "+n+"");q=new Int32Array(1+d);r=new Int32Array(1+d+g);for(k=1;k<=d;k++)q[m[k]]=k;for(k=1;k<=d+g;k++)r[h[k]]=k;for(l=1;l<=d+g;l++)p[l]=-1;for(h=1;h<=n;h++)k=r[h],p[k]=df;for(h=n+1;h<=d;h++)k=q[h],p[k]=df;for(l=1;l<=d+g;l++)p[l]!=df&&(n=function(a,b,c){switch(a){case ef:p[l]=ff;break;case gf:p[l]=hf;break;case jf:p[l]=kf;break;case lf:p[l]=Math.abs(b)<=Math.abs(c)?hf:kf;break;case af:p[l]=
mf}},l<=d?bf(a,l,n):$e(a,l-d,n));for(l=1;l<=d+g;l++)l<=d?Fb(a,l,p[l]-df+A):Gb(a,l-d,p[l]-df+A)}}0==a.h||0==a.n?Hb(a):d(a)}
function Mc(a,b){var c,d;if(0==a.Rc)for(c=a.Dd,d=a.Ca,0==c?a.Dd=20:a.Dd=c+c,a.Ca=Array(1+a.Dd),ka(a.Ca,0,1+a.Dd),null!=d&&ha(a.Ca,1,d,1,c),d=a.Dd;d>c;d--)a.Ca[d].node=null,a.Ca[d].next=a.Rc,a.Rc=d;d=a.Rc;a.Rc=a.Ca[d].next;a.Ca[d].next=0;c=d;d={};a.Ca[c].node=d;d.p=c;d.V=b;d.level=null==b?0:b.level+1;d.count=0;d.Qa=null;d.zc=null;d.fc=null;d.ag=0;d.rc=null==b?a.F.dir==za?-t:+t:b.rc;d.bound=null==b?a.F.dir==za?-t:+t:b.bound;d.Sc=0;d.pg=0;d.wg=0;d.Yc=0;d.Qd=0;0==a.u.Ke?d.data=null:d.data={};d.na=null;
d.ga=a.$a;d.next=null;null==a.head?a.head=d:a.$a.next=d;a.$a=d;a.Od++;a.Vf++;a.Fg++;null!=b&&b.count++;return d}
function nf(a,b){var c=a.F,d,e,f,g;d=a.Ca[b].node;a.R=d;e=a.Ca[1].node;if(d!=e){for(d.na=null;null!=d;d=d.V)null!=d.V&&(d.V.na=d);for(d=e;null!=d;d=d.na){var k=c.h;e=c.n;if(null==d.na){a.Bg=k;a.Cg<k+e&&(f=k+e+100,a.Cg=f,a.mf=new Int8Array(1+f),a.kf=new Float64Array(1+f),a.nf=new Float64Array(1+f),a.lf=new Int8Array(1+f));for(f=1;f<=k;f++)g=c.o[f],a.mf[f]=g.type,a.kf[f]=g.c,a.nf[f]=g.f,a.lf[f]=g.stat;for(f=1;f<=e;f++)g=c.g[f],a.mf[c.h+f]=g.type,a.kf[c.h+f]=g.c,a.nf[c.h+f]=g.f,a.lf[c.h+f]=g.stat}for(f=
d.Qa;null!=f;f=f.next)f.k<=k?Ua(c,f.k,f.type,f.c,f.f):Va(c,f.k-k,f.type,f.c,f.f);for(f=d.zc;null!=f;f=f.next)f.k<=k?Fb(c,f.k,f.stat):Gb(c,f.k-k,f.stat);if(null!=d.fc){var h,l,k=new Int32Array(1+e);l=new Float64Array(1+e);for(e=d.fc;null!=e;e=e.next){f=La(c,1);Pa(c,f,e.name);c.o[f].level=d.level;c.o[f].origin=e.origin;c.o[f].qc=e.qc;Ua(c,f,e.type,e.c,e.f);h=0;for(g=e.l;null!=g;g=g.next)h++,k[h]=g.H,l[h]=g.j;Ya(c,f,h,k,l);Ab(c,f,e.qa);Fb(c,f,e.stat)}}}for(d=a.R;null!=d.Qa;)f=d.Qa,d.Qa=f.next;for(;null!=
d.zc;)f=d.zc,d.zc=f.next;for(;null!=d.fc;)for(e=d.fc,d.fc=e.next;null!=e.l;)g=e.l,e.l=g.next}}
function of(a){var b=a.F,c=b.h,d=b.n,e=a.R,f,g,k;if(null==e.V)for(a.Eg=c,a.qe=new Int8Array(1+c+d),a.oe=new Float64Array(1+c+d),a.re=new Float64Array(1+c+d),a.pe=new Int8Array(1+c+d),f=1;f<=c+d;f++)k=f<=c?b.o[f]:b.g[f-c],a.qe[f]=k.type,a.oe[f]=k.c,a.re[f]=k.f,a.pe[f]=k.stat;else{var h=a.Eg,l=a.Bg;for(f=1;f<=l+d;f++){var n,m,q,r,p,u;n=a.mf[f];q=a.kf[f];r=a.nf[f];g=a.lf[f];k=f<=l?b.o[f]:b.g[f-l];m=k.type;p=k.c;u=k.f;k=k.stat;if(n!=m||q!=p||r!=u)n={},n.k=f,n.type=m,n.c=p,n.f=u,n.next=e.Qa,e.Qa=n;g!=
k&&(g={},g.k=f,g.stat=k,g.next=e.zc,e.zc=g)}if(l<c)for(m=new Int32Array(1+d),p=new Float64Array(1+d),g=c;g>l;g--){k=b.o[g];u={};f=mb(b,g);null==f?u.name=null:u.name=f;u.type=k.type;u.c=k.c;u.f=k.f;u.l=null;n=vb(b,g,m,p);for(f=1;f<=n;f++)q={},q.H=m[f],q.j=p[f],q.next=u.l,u.l=q;u.qa=k.qa;u.stat=k.stat;u.next=e.fc;e.fc=u}if(c!=h){c=c-h;e=new Int32Array(1+c);for(g=1;g<=c;g++)e[g]=h+g;ab(b,c,e)}c=b.h;for(g=1;g<=c;g++)Ua(b,g,a.qe[g],a.oe[g],a.re[g]),Fb(b,g,a.pe[g]);for(h=1;h<=d;h++)Va(b,h,a.qe[c+h],a.oe[c+
h],a.re[c+h]),Gb(b,h,a.pe[c+h])}a.R=null}function pf(a,b,c){var d;b=a.Ca[b].node;null==b.ga?a.head=b.next:b.ga.next=b.next;null==b.next?a.$a=b.ga:b.next.ga=b.ga;b.ga=b.next=null;a.Od--;for(d=1;2>=d;d++)c[d]=Mc(a,b).p}
function qf(a,b){var c;c=a.Ca[b].node;null==c.ga?a.head=c.next:c.ga.next=c.next;null==c.next?a.$a=c.ga:c.next.ga=c.ga;c.ga=c.next=null;for(a.Od--;;){for(var d;null!=c.Qa;)d=c.Qa,c.Qa=d.next;for(;null!=c.zc;)d=c.zc,c.zc=d.next;for(;null!=c.fc;){d=c.fc;for(d.name=null;null!=d.l;)d.l=d.l.next;c.fc=d.next}b=c.p;a.Ca[b].node=null;a.Ca[b].next=a.Rc;a.Rc=b;c=c.V;a.Vf--;if(null!=c&&(c.count--,0==c.count))continue;break}}
function rf(a,b,c){var d=a.F,e=d.h,f,g,k,h,l=a.xg,n=a.Og,m,q;xc(d);Ib(d);a=d.g[b].w;b=Bd(d,e+b,l,n);for(f=-1;1>=f;f+=2)if(k=l,g=Fd(d,b,k,n,f,1E-9),g=0==g?0:k[g],0==g)d.dir==za?0>f?m=+t:q=+t:d.dir==Ea&&(0>f?m=-t:q=-t);else{for(k=1;k<=b&&l[k]!=g;k++);k=n[k];g<=e?(h=d.o[g].stat,g=d.o[g].M):(h=d.g[g-e].stat,g=d.g[g-e].M);if(d.dir==za){if(h==M&&0>g||h==P&&0<g||h==Ra)g=0}else d.dir==Ea&&(h==M&&0<g||h==P&&0>g||h==Ra)&&(g=0);h=(0>f?Math.floor(a):Math.ceil(a))-a;h/=k;k=g*h;0>f?m=d.ea+k:q=d.ea+k}c(m,q)}
function sf(a,b){var c=a.F,d=c.n,e,f,g,k=a.xg,h;g=0;h=c.la;e=0;for(f=1;f<=d;f++){var l=c.g[f];if(0!=l.B)if(l.type==C)h+=l.B*l.w;else{if(l.kind!=Fc||l.B!=Math.floor(l.B))return b;2147483647>=Math.abs(l.B)?k[++g]=Math.abs(l.B)|0:e=1}}if(0==e){if(0==g)return b;d=0;for(e=1;e<=g;e++){if(1==e)d=k[1];else for(f=k[e],l=void 0;0<f;)l=d%f,d=f,f=l;if(1==d)break}e=d}c.dir==za?b!=+t&&(c=(b-h)/e,c>=Math.floor(c)+.001&&(c=Math.ceil(c),b=e*c+h)):c.dir==Ea&&b!=-t&&(c=(b-h)/e,c<=Math.ceil(c)-.001&&(c=Math.floor(c),
b=e*c+h));return b}function tf(a,b){var c=a.F,d=1,e;if(c.Da==ec)switch(e=a.u.ue*(1+Math.abs(c.xa)),c.dir){case za:b>=c.xa-e&&(d=0);break;case Ea:b<=c.xa+e&&(d=0)}else switch(c.dir){case za:b==+t&&(d=0);break;case Ea:b==-t&&(d=0)}return d}function uf(a){var b=null;switch(a.F.dir){case za:for(a=a.head;null!=a;a=a.next)if(null==b||b.bound>a.bound)b=a;break;case Ea:for(a=a.head;null!=a;a=a.next)if(null==b||b.bound<a.bound)b=a}return null==b?0:b.p}
var vf=exports.glp_ios_relative_gap=function(a){var b=a.F,c;b.Da==ec?(b=b.xa,c=uf(a),0==c?a=0:(a=a.Ca[c].node.bound,a=Math.abs(b-a)/(Math.abs(b)+2.220446049250313E-16))):a=t;return a};function wf(a){var b=a.F,c=new kc;switch(a.u.s){case lc:c.s=lc;break;case Mb:c.s=Mb;break;case fc:case Xb:c.s=fc;break;case mc:c.s=Xb}c.hb=Rb;a.u.s<mc?c.cb=a.u.cb:c.cb=0;if(b.Da==ec)switch(a.F.dir){case za:c.ff=b.xa;break;case Ea:c.ef=b.xa}b=sc(b,c);a.R.ag++;return b}
function Oc(a){for(;null!=a.head;){var b=a.head;for(a.head=b.next;null!=b.l;)b.l=b.l.next}a.size=0;a.head=a.$a=null;a.$g=0;a.R=null}
function xf(a,b){function c(a,b,c,d,e){var f,g,k;g=k=0;for(f=1;f<=a;f++)if(0<b[f])if(c[f]==-t)if(0==g)g=f;else{k=-t;g=0;break}else k+=b[f]*c[f];else if(0>b[f])if(d[f]==+t)if(0==g)g=f;else{k=-t;g=0;break}else k+=b[f]*d[f];e.Ud=k;e.Qf=g;g=k=0;for(f=1;f<=a;f++)if(0<b[f])if(d[f]==+t)if(0==g)g=f;else{k=+t;g=0;break}else k+=b[f]*d[f];else if(0>b[f])if(c[f]==-t)if(0==g)g=f;else{k=+t;g=0;break}else k+=b[f]*c[f];e.Td=k;e.Pf=g}function d(a,b){b(0==a.Qf?a.Ud:-t,0==a.Pf?a.Td:+t)}function e(a,b,c,d,e,f,g,k){var h,
l,m,p;c==-t||a.Td==+t?h=-t:0==a.Pf?0<b[g]?h=c-(a.Td-b[g]*f[g]):0>b[g]&&(h=c-(a.Td-b[g]*e[g])):h=a.Pf==g?c-a.Td:-t;d==+t||a.Ud==-t?l=+t:0==a.Qf?0<b[g]?l=d-(a.Ud-b[g]*e[g]):0>b[g]&&(l=d-(a.Ud-b[g]*f[g])):l=a.Qf==g?d-a.Ud:+t;1E-6>Math.abs(b[g])?(m=-t,p=+t):0<b[g]?(m=h==-t?-t:h/b[g],p=l==+t?+t:l/b[g]):0>b[g]&&(m=l==+t?-t:l/b[g],p=h==-t?+t:h/b[g]);k(m,p)}function f(a,b,c,e,f){var g=0,k=b[c],h=e[f],l=null,m=null;d(a,function(a,b){l=a;m=b});if(k!=-t&&(a=.001*(1+Math.abs(k)),m<k-a)||h!=+t&&(a=.001*(1+Math.abs(h)),
l>h+a))return 1;k!=-t&&(a=1E-12*(1+Math.abs(k)),l>k-a&&(b[c]=-t));h!=+t&&(a=1E-12*(1+Math.abs(h)),m<h+a&&(e[f]=+t));return g}function g(a,b,c,d,f,g,k,h,l){var m=0,p,n,q=null,r=null;p=f[h];n=g[h];e(a,b,c,d,f,g,h,function(a,b){q=a;r=b});k&&(q!=-t&&(q=.001>q-Math.floor(q)?Math.floor(q):Math.ceil(q)),r!=+t&&(r=.001>Math.ceil(r)-r?Math.ceil(r):Math.floor(r)));if(p!=-t&&(a=.001*(1+Math.abs(p)),r<p-a)||n!=+t&&(a=.001*(1+Math.abs(n)),q>n+a))return 1;q!=-t&&(a=.001*(1+Math.abs(q)),p<q-a&&(p=q));r!=+t&&(a=
.001*(1+Math.abs(r)),n>r+a&&(n=r));p!=-t&&n!=+t&&(a=Math.abs(p),b=Math.abs(n),p>n-1E-10*(1+(a<=b?a:b))&&(p==f[h]?n=p:n==g[h]?p=n:a<=b?n=p:p=n));l(p,n);return m}function k(a,b,c,d,e){var f,g=0;b<d&&(a||b==-t?g++:(f=c==+t?1+Math.abs(b):1+(c-b),d-b>=.25*f&&g++));c>e&&(a||c==+t?g++:(f=b==-t?1+Math.abs(c):1+(c-b),c-e>=.25*f&&g++));return g}var h=a.F,l=h.h,n=h.n,m,q,r,p=0,u,v,H,E;u=new Float64Array(1+l);v=new Float64Array(1+l);switch(h.Da){case Aa:u[0]=-t;v[0]=+t;break;case ec:switch(h.dir){case za:u[0]=
-t;v[0]=h.xa-h.la;break;case Ea:u[0]=h.xa-h.la,v[0]=+t}}for(m=1;m<=l;m++)u[m]=qb(h,m),v[m]=rb(h,m);H=new Float64Array(1+n);E=new Float64Array(1+n);for(m=1;m<=n;m++)H[m]=tb(h,m),E[m]=ub(h,m);q=l+1;r=new Int32Array(1+q);for(m=1;m<=q;m++)r[m]=m-1;if(function(a,b,d,e,h,l,m,p){var n=a.h,q=a.n,r={},u,H,v=0,w,E,L,K,aa,N,da,ea;w=new Int32Array(1+q);E=new Int32Array(1+n+1);L=new Int32Array(1+n+1);K=new Int32Array(1+n+1);aa=new Float64Array(1+q);N=new Float64Array(1+q);da=new Float64Array(1+q);H=0;for(u=1;u<=
l;u++)n=m[u],E[++H]=n,L[n]=1;for(;0<H;)if(n=E[H--],L[n]=0,K[n]++,b[n]!=-t||d[n]!=+t){l=0;if(0==n)for(m=1;m<=q;m++)ea=a.g[m],0!=ea.B&&(l++,w[l]=m,aa[l]=ea.B);else for(m=a.o[n].l;null!=m;m=m.G)l++,w[l]=m.g.H,aa[l]=m.j;for(u=1;u<=l;u++)m=w[u],N[u]=e[m],da[u]=h[m];c(l,aa,N,da,r);if(f(r,b,n,d,n)){v=1;break}if(b[n]!=-t||d[n]!=+t)for(u=1;u<=l;u++){var I,ia=null,Wa=null;m=w[u];ea=a.g[m];I=ea.kind!=Ma;if(g(r,aa,b[n],d[n],N,da,I,u,function(a,b){ia=a;Wa=b}))return v=1;I=k(I,e[m],h[m],ia,Wa);e[m]=ia;h[m]=Wa;
if(0<I)for(m=ea.l;null!=m;m=m.L)ea=m.o.ia,K[ea]>=p||b[ea]==-t&&d[ea]==+t||0!=L[ea]||(E[++H]=ea,L[ea]=1)}}return v}(h,u,v,H,E,q,r,b))return 1;for(m=1;m<=l;m++)zc(h,m)==A&&(u[m]==-t&&v[m]==+t?Ua(h,m,Ka,0,0):v[m]==+t?Ua(h,m,Sa,u[m],0):u[m]==-t&&Ua(h,m,Ta,0,v[m]));for(m=1;m<=n;m++)Va(h,m,H[m]==-t&&E[m]==+t?Ka:E[m]==+t?Sa:H[m]==-t?Ta:H[m]!=E[m]?Q:C,H[m],E[m]);return p}
function Nc(a){function b(a,b){var c,d,e,f;d=a.F.Da==ec?String(a.F.xa):"not found yet";c=uf(a);0==c?e="tree is empty":(c=a.Ca[c].node.bound,c==-t?e="-inf":c==+t?e="+inf":e=c);a.F.dir==za?f=">=":a.F.dir==Ea&&(f="<=");c=vf(a);y("+"+a.F.da+": "+(b?">>>>>":"mip =")+" "+d+" "+f+" "+e+" "+(0==c?"  0.0%":.001>c?" < 0.1%":9.999>=c?"  "+Number(100*c).toFixed(1)+"%":"")+" ("+a.Od+"; "+(a.Fg-a.Vf)+")");a.Hg=la()}function c(a,b){return tf(a,a.Ca[b].node.bound)}function d(a){var b=a.F,c,d,e=0,f,g,k,h,l,m=0;for(c=
1;c<=b.n;c++)if(k=b.g[c],a.$c[c]=0,k.kind==Fc&&k.stat==A){d=k.type;f=k.c;g=k.f;k=k.w;if(d==Sa||d==Q||d==C){h=f-a.u.Xb;l=f+a.u.Xb;if(h<=k&&k<=l)continue;if(k<f)continue}if(d==Ta||d==Q||d==C){h=g-a.u.Xb;l=g+a.u.Xb;if(h<=k&&k<=l)continue;if(k>g)continue}h=Math.floor(k+.5)-a.u.Xb;l=Math.floor(k+.5)+a.u.Xb;h<=k&&k<=l||(a.$c[c]=1,e++,h=k-Math.floor(k),l=Math.ceil(k)-k,m+=h<=l?h:l)}a.R.wg=e;a.R.Yc=m;a.u.s>=mc&&(0==e?y("There are no fractional columns"):1==e?y("There is one fractional column, integer infeasibility is "+
m+""):y("There are "+e+" fractional columns, integer infeasibility is "+m+""))}function e(a){var b=a.F,c;b.Da=ec;b.xa=b.ea;for(c=1;c<=b.h;c++){var d=b.o[c];d.Va=d.w}for(c=1;c<=b.n;c++)d=b.g[c],d.kind==Ma?d.Va=d.w:d.kind==Fc&&(d.Va=Math.floor(d.w+.5));a.lh++}function f(a,b,c){var d=a.F,e,f=d.h,g,k,h,l,m,p=Array(3),n,q,r,u,w=null,v=null,L;g=d.g[b].type;n=d.g[b].c;q=d.g[b].f;e=d.g[b].w;r=Math.floor(e);u=Math.ceil(e);switch(g){case Ka:k=Ta;h=Sa;break;case Sa:k=n==r?C:Q;h=Sa;break;case Ta:k=Ta;h=u==q?
C:Q;break;case Q:k=n==r?C:Q,h=u==q?C:Q}rf(a,b,function(a,b){w=a;v=b});g=sf(a,w);L=sf(a,v);l=!tf(a,g);m=!tf(a,L);if(l&&m)return a.u.s>=mc&&y("Both down- and up-branches are hopeless"),2;if(m)return a.u.s>=mc&&y("Up-branch is hopeless"),Va(d,b,k,n,r),a.R.rc=w,d.dir==za?a.R.bound<g&&(a.R.bound=g):d.dir==Ea&&a.R.bound>g&&(a.R.bound=g),1;if(l)return a.u.s>=mc&&y("Down-branch is hopeless"),Va(d,b,h,u,q),a.R.rc=v,d.dir==za?a.R.bound<L&&(a.R.bound=L):d.dir==Ea&&a.R.bound>L&&(a.R.bound=L),1;a.u.s>=mc&&y("Branching on column "+
b+", primal value is "+e+"");l=a.R.p;a.R.Sc=b;a.R.pg=e;of(a);pf(a,l,p);a.u.s>=mc&&y("Node "+p[1]+" begins down branch, node "+p[2]+" begins up branch ");e=a.Ca[p[1]].node;e.Qa={};e.Qa.k=f+b;e.Qa.type=k;e.Qa.c=n;e.Qa.f=r;e.Qa.next=null;e.rc=w;d.dir==za?e.bound<g&&(e.bound=g):d.dir==Ea&&e.bound>g&&(e.bound=g);e=a.Ca[p[2]].node;e.Qa={};e.Qa.k=f+b;e.Qa.type=h;e.Qa.c=u;e.Qa.f=q;e.Qa.next=null;e.rc=v;d.dir==za?e.bound<L&&(e.bound=L):d.dir==Ea&&e.bound>L&&(e.bound=L);c==yf?a.sd=0:c==zf?a.sd=p[1]:c==Af&&
(a.sd=p[2]);return 0}function g(a){var b=a.F,c,d,e=0,f,g,k,h;f=b.ea;for(c=1;c<=b.n;c++)if(h=b.g[c],h.kind==Fc)switch(g=h.c,k=h.f,d=h.stat,h=h.M,b.dir){case za:d==M?(0>h&&(h=0),f+h>=b.xa&&(Va(b,c,C,g,g),e++)):d==P&&(0<h&&(h=0),f-h>=b.xa&&(Va(b,c,C,k,k),e++));break;case Ea:d==M?(0<h&&(h=0),f+h<=b.xa&&(Va(b,c,C,g,g),e++)):d==P&&(0>h&&(h=0),f-h<=b.xa&&(Va(b,c,C,k,k),e++))}a.u.s>=mc&&0!=e&&(1==e?y("One column has been fixed by reduced cost"):y(e+" columns have been fixed by reduced costs"))}function k(a){var b,
c=0,d=null;for(b=a.wc+1;b<=a.F.h;b++)a.F.o[b].origin==Ja&&a.F.o[b].level==a.R.level&&a.F.o[b].stat==A&&(null==d&&(d=new Int32Array(1+a.F.h)),d[++c]=b);0<c&&(ab(a.F,c,d),Jb(a.F))}function h(a){var b=a.F,c,d=0,e=0,f=0,g=0,k=0;for(c=b.h;0<c;c--){var h=b.o[c];h.origin==Ja&&(h.qc==Bf?d++:h.qc==Cf?e++:h.qc==Df?f++:h.qc==Ef?g++:k++)}0<d+e+f+g+k&&(y("Cuts on level "+a.R.level+":"),0<d&&y(" gmi = "+d+";"),0<e&&y(" mir = "+e+";"),0<f&&y(" cov = "+f+";"),0<g&&y(" clq = "+g+";"),0<k&&y(" app = "+k+";"),y(""))}
function l(a){if(a.u.Bd==bb||a.u.yd==bb||a.u.vd==bb||a.u.td==bb){var b,c,d;c=a.n;1E3>c&&(c=1E3);d=0;for(b=a.wc+1;b<=a.F.h;b++)a.F.o[b].origin==Ja&&d++;if(!(d>=c)){a.u.yd==bb&&5>a.R.Qd&&Ff(a);a.u.Bd==bb&&Gf(a,a.Tf);if(a.u.vd==bb){b=a.F;c=kb(b);var e=lb(b),f,g,k,h,l;xc(b);d=new Int32Array(1+e);h=new Float64Array(1+e);l=new Float64Array(1+e);for(e=1;e<=c;e++)for(k=1;2>=k;k++){g=pb(b,e)-Ka+ef;if(1==k){if(g!=jf&&g!=lf)continue;g=vb(b,e,d,h);h[0]=Hf(b,e)}else{if(g!=gf&&g!=lf)continue;g=vb(b,e,d,h);for(f=
1;f<=g;f++)h[f]=-h[f];h[0]=-If(b,e)}a:{var m=b;f=d;for(var p=h,n=l,q=null,r=null,u=Array(5),w=void 0,v=void 0,L=void 0,K=L=void 0,aa=void 0,N=K=K=void 0,L=0,v=1;v<=g;v++)w=f[v],sb(m,w)-Ka+ef==af?p[0]-=p[v]*Jf(m,w):(L++,f[L]=f[v],p[L]=p[v]);g=L;L=0;for(v=1;v<=g;v++)w=f[v],(Ic(m,w)==Ma?Kf:Lf)==Lf&&sb(m,w)-Ka+ef==lf&&0==Jf(m,w)&&1==Mf(m,w)&&(L++,aa=f[L],K=p[L],f[L]=f[v],p[L]=p[v],f[v]=aa,p[v]=K);if(2>L)g=0;else{aa=K=0;for(v=L+1;v<=g;v++){w=f[v];if(sb(m,w)-Ka+ef!=lf){g=0;break a}0<p[v]?(aa+=p[v]*Jf(m,
w),K+=p[v]*Mf(m,w)):(aa+=p[v]*Mf(m,w),K+=p[v]*Jf(m,w))}K-=aa;N=0;for(v=L+1;v<=g;v++)w=f[v],N+=p[v]*Dc(m,w);N-=aa;0>N&&(N=0);N>K&&(N=K);p[0]-=aa;for(v=1;v<=L;v++)w=f[v],n[v]=Dc(m,w),0>n[v]&&(n[v]=0),1<n[v]&&(n[v]=1);for(v=1;v<=L;v++)0>p[v]&&(f[v]=-f[v],p[v]=-p[v],p[0]+=p[v],n[v]=1-n[v]);m=L;v=p[0];w=N;N=void 0;for(N=1;N<=m;N++);for(N=1;N<=m;N++);N=void 0;b:{for(var da=N=void 0,ea=0,I=0,ia=void 0,Wa=void 0,ob=.001,ia=.001*(1+Math.abs(v)),N=1;N<=m;N++)for(da=N+1;da<=m;da++){ea++;if(1E3<ea){N=I;break b}p[N]+
p[da]+w>v+ia&&(Wa=p[N]+p[da]-v,q=1/(Wa+K),r=2-q*Wa,Wa=n[N]+n[da]+q*w-r,ob<Wa&&(ob=Wa,u[1]=N,u[2]=da,I=1))}N=I}da=void 0;if(N)da=2;else{N=void 0;b:{for(var ea=da=N=void 0,ia=I=0,ob=Wa=void 0,Lb=.001,Wa=.001*(1+Math.abs(v)),N=1;N<=m;N++)for(da=N+1;da<=m;da++)for(ea=da+1;ea<=m;ea++){I++;if(1E3<I){N=ia;break b}p[N]+p[da]+p[ea]+w>v+Wa&&(ob=p[N]+p[da]+p[ea]-v,q=1/(ob+K),r=3-q*ob,ob=n[N]+n[da]+n[ea]+q*w-r,Lb<ob&&(Lb=ob,u[1]=N,u[2]=da,u[3]=ea,ia=1))}N=ia}da=void 0;if(N)da=3;else{N=void 0;b:{for(var I=ea=
da=N=void 0,Wa=ia=0,Lb=ob=void 0,bh=.001,ob=.001*(1+Math.abs(v)),N=1;N<=m;N++)for(da=N+1;da<=m;da++)for(ea=da+1;ea<=m;ea++)for(I=ea+1;I<=m;I++){ia++;if(1E3<ia){N=Wa;break b}p[N]+p[da]+p[ea]+p[I]+w>v+ob&&(Lb=p[N]+p[da]+p[ea]+p[I]-v,q=1/(Lb+K),r=4-q*Lb,Lb=n[N]+n[da]+n[ea]+n[I]+q*w-r,bh<Lb&&(bh=Lb,u[1]=N,u[2]=da,u[3]=ea,u[4]=I,Wa=1))}N=Wa}da=N?4:0}}K=da;if(0==K)g=0;else{f[0]=0;p[0]=r;for(w=1;w<=K;w++)u[w]=f[u[w]];for(v=1;v<=K;v++)0<u[v]?(f[v]=+u[v],p[v]=1):(f[v]=-u[v],p[v]=-1,--p[0]);for(v=L+1;v<=g;v++)K++,
f[K]=f[v],p[K]=q*p[v];p[0]+=q*aa;g=K}}}if(0!=g){f=b;p=g;n=d;q=h;r=lb(f);L=u=void 0;aa=0;0>p&&x("lpx_eval_row: len = "+p+"; invalid row length");for(L=1;L<=p;L++)u=n[L],1<=u&&u<=r||x("lpx_eval_row: j = "+u+"; column number out of range"),aa+=q[L]*Dc(f,u);f=aa-h[0];.001>f||Id(a,Df,g,d,h,Ta,h[0])}}}a.u.td==bb&&null!=a.Le&&(0==a.R.level&&50>a.R.Qd||0<a.R.level&&5>a.R.Qd)&&(c=a.Le,d=lb(a.F),b=new Int32Array(1+d),d=new Float64Array(1+d),c=Nf(a.F,c,b,d),0<c&&Id(a,Ef,c,b,d,Ta,d[0]))}}}function n(a){var b,
d,e=0;for(b=a.head;null!=b;b=d)d=b.next,c(a,b.p)||(qf(a,b.p),e++);a.u.s>=mc&&(1==e?y("One hopeless branch has been pruned"):1<e&&y(e+" hopeless branches have been pruned"))}var m,q,r,p,u=0,v=a.ic;for(q=0;;){r=null;switch(q){case 0:if(null==a.head){a.u.s>=mc&&y("Active list is empty!");p=0;r=3;break}if(null!=a.u.rb&&(a.reason=Of,a.u.rb(a,a.u.Tc),a.reason=0,a.stop)){p=Rc;r=3;break}0==a.Cd&&(1==a.Od?a.Cd=a.head.p:0!=a.sd?a.Cd=a.sd:a.Cd=Pf(a));nf(a,a.Cd);a.Cd=a.sd=0;null!=a.R.V&&a.R.V.p!=u&&(u=0);m=a.R.p;
a.u.s>=mc&&(y("------------------------------------------------------------------------"),y("Processing node "+m+" at level "+a.R.level+""));1==m&&(a.u.yd==bb&&a.u.s>=Xb&&y("Gomory's cuts enabled"),a.u.Bd==bb&&(a.u.s>=Xb&&y("MIR cuts enabled"),a.Tf=Qf(a)),a.u.vd==bb&&a.u.s>=Xb&&y("Cover cuts enabled"),a.u.td==bb&&(a.u.s>=Xb&&y("Clique cuts enabled"),a.Le=Rf(a.F)));case 1:(a.u.s>=mc||a.u.s>=fc&&a.u.dc-1<=1E3*ma(a.Hg))&&b(a,0);a.u.s>=Xb&&60<=ma(v)&&(y("Time used: "+ma(a.ic)+" secs"),v=la());if(0<a.u.ae&&
vf(a)<=a.u.ae){a.u.s>=mc&&y("Relative gap tolerance reached; search terminated ");p=Pc;r=3;break}if(2147483647>a.u.ub&&a.u.ub-1<=1E3*ma(a.ic)){a.u.s>=mc&&y("Time limit exhausted; search terminated");p=Qc;r=3;break}if(null!=a.u.rb&&(a.reason=Sf,a.u.rb(a,a.u.Tc),a.reason=0,a.stop)){p=Rc;r=3;break}if(a.u.dd!=hd)if(a.u.dd==id){if(0==a.R.level&&xf(a,100)){r=2;break}}else if(a.u.dd==jd&&xf(a,0==a.R.level?100:10)){r=2;break}if(!c(a,m)){y("*** not tested yet ***");r=2;break}a.u.s>=mc&&y("Solving LP relaxation...");
p=wf(a);if(0!=p&&p!=Tf&&p!=Uf){a.u.s>=Mb&&y("ios_driver: unable to solve current LP relaxation; glp_simplex returned "+p+"");p=Tb;r=3;break}q=a.F.ra;r=a.F.wa;if(q==ec&&r==ec)a.u.s>=mc&&y("Found optimal solution to LP relaxation");else if(r==jc){a.u.s>=Mb&&y("ios_driver: current LP relaxation has no dual feasible solution");p=Tb;r=3;break}else if(q==Ad&&r==ec){a.u.s>=mc&&y("LP relaxation has no solution better than incumbent objective value");r=2;break}else if(q==jc){a.u.s>=mc&&y("LP relaxation has no feasible solution");
r=2;break}q=a.R.rc=a.F.ea;q=sf(a,q);a.F.dir==za?a.R.bound<q&&(a.R.bound=q):a.F.dir==Ea&&a.R.bound>q&&(a.R.bound=q);a.u.s>=mc&&y("Local bound is "+q+"");if(!c(a,m)){a.u.s>=mc&&y("Current branch is hopeless and can be pruned");r=2;break}if(null!=a.u.rb){a.reason=Ga;a.u.rb(a,a.u.Tc);a.reason=0;if(a.stop){p=Rc;r=3;break}if(a.ne){a.ne=a.pf=0;r=1;break}a.pf&&(a.pf=0,Jb(a.F))}d(a);if(0==a.R.wg){a.u.s>=mc&&y("New integer feasible solution found");a.u.s>=Xb&&h(a);e(a);a.u.s>=fc&&b(a,1);if(null!=a.u.rb&&(a.reason=
Vf,a.u.rb(a,a.u.Tc),a.reason=0,a.stop)){p=Rc;r=3;break}r=2;break}a.F.Da==ec&&g(a);if(null!=a.u.rb){a.reason=Wf;a.u.rb(a,a.u.Tc);a.reason=0;if(a.stop){p=Rc;r=3;break}if(!c(a,m)){a.u.s>=mc&&y("Current branch became hopeless and can be pruned");r=2;break}}if(a.u.Ve&&(a.reason=Wf,Xf(a),a.reason=0,!c(a,m))){a.u.s>=mc&&y("Current branch became hopeless and can be pruned");r=2;break}if(null!=a.u.rb&&(a.reason=Ia,a.u.rb(a,a.u.Tc),a.reason=0,a.stop)){p=Rc;r=3;break}if(0==a.R.level||0==u)a.reason=Ia,l(a),a.reason=
0;0<a.local.size&&(a.reason=Ia,Yf(a),a.reason=0);Oc(a.local);if(a.ne){a.ne=0;a.R.Qd++;r=1;break}k(a);a.u.s>=Xb&&0==a.R.level&&h(a);null!=a.Ed&&Zf(a);if(null!=a.u.rb&&(a.reason=$f,a.u.rb(a,a.u.Tc),a.reason=0,a.stop)){p=Rc;r=3;break}0==a.Sc&&(a.Sc=ag(a,function(b){a.Ff=b}));q=a.R.p;p=f(a,a.Sc,a.Ff);a.Sc=a.Ff=0;if(0==p){u=q;r=0;break}else if(1==p){a.R.ag=a.R.Qd=0;r=1;break}else if(2==p){r=2;break}case 2:a.u.s>=mc&&y("Node "+m+" fathomed");of(a);qf(a,m);a.F.Da==ec&&n(a);r=u=0;break;case 3:return a.u.s>=
fc&&b(a,0),a.Tf=null,a.Le=null,p}if(null==r)break;q=r}}function bg(a){var b;b={};b.n=a;b.O=0;b.Na=new Int32Array(1+a);b.ca=new Int32Array(1+a);b.j=new Float64Array(1+a);return b}function cg(a,b,c){var d=a.Na[b];0==c?0!=d&&(a.Na[b]=0,d<a.O&&(a.Na[a.ca[a.O]]=d,a.ca[d]=a.ca[a.O],a.j[d]=a.j[a.O]),a.O--):(0==d&&(d=++a.O,a.Na[b]=d,a.ca[d]=b),a.j[d]=c)}function dg(a){for(var b=1;b<=a.O;b++)a.Na[a.ca[b]]=0;a.O=0}
function eg(a,b){for(var c=0,d=1;d<=a.O;d++)0==Math.abs(a.j[d])||Math.abs(a.j[d])<b?a.Na[a.ca[d]]=0:(c++,a.Na[a.ca[d]]=c,a.ca[c]=a.ca[d],a.j[c]=a.j[d]);a.O=c}function fg(a,b){dg(a);a.O=b.O;ha(a.ca,1,b.ca,1,a.O);ha(a.j,1,b.j,1,a.O);for(var c=1;c<=a.O;c++)a.Na[a.ca[c]]=c}
function Ff(a){function b(a){return a-Math.floor(a)}function c(a,c,d){var e=a.F,f=e.h,g=e.n,k=c.ca,h=c.j;c=c.fh;var l,B,J,R,T,O,S,G,Z,Y,ba;B=Bd(e,f+d,k,h);G=e.g[d].w;for(l=1;l<=f+g;l++)c[l]=0;ba=b(G);for(d=1;d<=B;d++){l=k[d];l<=f?(R=e.o[l],J=Ma):(R=e.g[l-f],J=R.kind);T=R.c;O=R.f;R=R.stat;Z=h[d];if(1E5<Math.abs(Z))return;if(!(1E-10>Math.abs(Z))){switch(R){case Ra:return;case M:S=-Z;break;case P:S=+Z;break;case Na:continue}switch(J){case Fc:if(1E-10>Math.abs(S-Math.floor(S+.5)))continue;else b(S)<=
b(G)?Y=b(S):Y=b(G)/(1-b(G))*(1-b(S));break;case Ma:Y=0<=S?+S:b(G)/(1-b(G))*-S}switch(R){case M:c[l]=+Y;ba+=Y*T;break;case P:c[l]=-Y,ba-=Y*O}}}for(d=1;d<=f;d++)if(!(1E-10>Math.abs(c[d])))for(R=e.o[d],S=R.l;null!=S;S=S.G)c[f+S.g.H]+=c[d]*S.j;B=0;for(d=1;d<=g;d++)1E-10>Math.abs(c[f+d])||(R=e.g[d],R.type==C?ba-=c[f+d]*R.c:(B++,k[B]=d,h[B]=c[f+d]));1E-12>Math.abs(ba)&&(ba=0);for(l=1;l<=B;l++)if(.001>Math.abs(h[l])||1E3<Math.abs(h[l]))return;Id(a,Bf,B,k,h,Sa,ba)}var d=a.F,e=d.h,f=d.n,g,k,h={};g=Array(1+
f);h.ca=new Int32Array(1+f);h.j=new Float64Array(1+f);h.fh=new Float64Array(1+e+f);e=0;for(k=1;k<=f;k++){var l=d.g[k];l.kind==Fc&&l.type!=C&&l.stat==A&&(l=b(l.w),.05<=l&&.95>=l&&(e++,g[e].H=k,g[e].Pb=l))}na(g,e,function(a,b){return a.Pb>b.Pb?-1:a.Pb<b.Pb?1:0});f=Hd(a);for(d=1;d<=e&&!(50<=Hd(a)-f);d++)c(a,h,g[d].H)}var gg=0,hg=5,ig=0,jg=1,kg=2;
function Qf(a){var b=a.F,c=b.h,b=b.n,d;gg&&y("ios_mir_init: warning: debug mode enabled");d={};d.h=c;d.n=b;d.Gb=new Int8Array(1+c);d.fb=new Int8Array(1+c+b);d.c=new Float64Array(1+c+b);d.ac=new Int32Array(1+c+b);d.f=new Float64Array(1+c+b);d.Bb=new Int32Array(1+c+b);d.x=new Float64Array(1+c+b);d.Af=new Int32Array(1+hg);d.ab=bg(c+b);d.ob=new Int8Array(1+c+b);d.sa=bg(c+b);d.J=bg(c+b);(function(a,b){var c=a.F,d=b.h,h;for(h=1;h<=d;h++){var l=c.o[h];b.Gb[h]=0;b.fb[h]=0;switch(l.type){case Ka:b.c[h]=-t;
b.f[h]=+t;break;case Sa:b.c[h]=l.c;b.f[h]=+t;break;case Ta:b.c[h]=-t;b.f[h]=l.f;break;case Q:b.c[h]=l.c;b.f[h]=l.f;break;case C:b.c[h]=b.f[h]=l.c}b.ac[h]=b.Bb[h]=0}})(a,d);(function(a,b){var c=a.F,d=b.h,h=b.n,l;for(l=d+1;l<=d+h;l++){var n=c.g[l-d];switch(n.kind){case Ma:b.fb[l]=0;break;case Fc:b.fb[l]=1}switch(n.type){case Ka:b.c[l]=-t;b.f[l]=+t;break;case Sa:b.c[l]=n.c;b.f[l]=+t;break;case Ta:b.c[l]=-t;b.f[l]=n.f;break;case Q:b.c[l]=n.c;b.f[l]=n.f;break;case C:b.c[l]=b.f[l]=n.c}b.ac[l]=b.Bb[l]=0}})(a,
d);(function(a,b){var c=a.F,d=b.h,h,l,n,m,q,r;for(l=1;l<=d;l++)if(0==b.c[l]&&b.f[l]==+t||b.c[l]==-t&&0==b.f[l])if(h=c.o[l].l,null!=h&&(n=d+h.g.H,q=h.j,h=h.G,null!=h&&(m=d+h.g.H,r=h.j,null==h.G))){if(b.fb[n]||!b.fb[m])if(b.fb[n]&&!b.fb[m])m=n,r=q,n=d+h.g.H,q=h.j;else continue;b.c[m]!=-t&&b.f[m]!=+t&&b.c[m]!=b.f[m]&&(0==b.f[l]&&(q=-q,r=-r),0<q?0==b.ac[n]&&(b.c[n]=-r/q,b.ac[n]=m,b.Gb[l]=1):0==b.Bb[n]&&(b.f[n]=-r/q,b.Bb[n]=m,b.Gb[l]=1))}})(a,d);(function(a,b){var c=a.F,d=b.h,h,l,n,m;for(l=1;l<=d;l++)if(b.c[l]==
-t&&b.f[l]==+t)b.Gb[l]=1;else{m=0;for(h=c.o[l].l;null!=h;h=h.G){n=d+h.g.H;if(b.c[n]==-t&&b.f[n]==+t){b.Gb[l]=1;break}if(b.fb[n]&&b.c[n]==-t||b.fb[n]&&b.f[n]==+t){b.Gb[l]=1;break}0==b.ac[n]&&0==b.Bb[n]&&b.c[n]==b.f[n]||m++}0==m&&(b.Gb[l]=1)}})(a,d);return d}
function Gf(a,b){function c(a,b,c,d,e,f,g){function k(a,b,c,d,e,f,g){var h;h=c;for(c=1;c<=a;c++)g[c]=b[c]/f,e[c]&&(g[c]=-g[c]),h-=b[c]*d[c];b=h/f;var l;if(.01>Math.abs(b-Math.floor(b+.5)))b=1;else{h=b-Math.floor(b);for(c=1;c<=a;c++)l=g[c]-Math.floor(g[c])-h,g[c]=0>=l?Math.floor(g[c]):Math.floor(g[c])+l/(1-h);q=Math.floor(b);r=1/(1-h);b=0}if(b)return 1;for(c=1;c<=a;c++)e[c]&&(g[c]=-g[c],q+=g[c]*d[c]);r/=f;return 0}var h,l,m,p,n;m=Array(4);var u,v,B,H;B=new Int8Array(1+a);H=Array(1+a);for(l=1;l<=a;l++)B[l]=
e[l]>=.5*d[l];v=n=0;for(l=1;l<=a;l++)if(h=1E-9*(1+Math.abs(d[l])),!(e[l]<h||e[l]>d[l]-h||(h=k(a,b,c,d,B,Math.abs(b[l]),g),h))){u=-q-r*f;for(h=1;h<=a;h++)u+=g[h]*e[h];v<u&&(v=u,n=Math.abs(b[l]))}.001>v&&(v=0);if(0==v)return v;m[1]=n/2;m[2]=n/4;m[3]=n/8;for(l=1;3>=l;l++)if(h=k(a,b,c,d,B,m[l],g),!h){u=-q-r*f;for(h=1;h<=a;h++)u+=g[h]*e[h];v<u&&(v=u,n=m[l])}m=0;for(l=1;l<=a;l++)h=1E-9*(1+Math.abs(d[l])),e[l]<h||e[l]>d[l]-h||(m++,H[m].H=l,H[m].tf=Math.abs(e[l]-.5*d[l]));na(H,m,function(a,b){return a.tf<
b.tf?-1:a.tf>b.tf?1:0});for(p=1;p<=m;p++)if(l=H[p].H,B[l]=!B[l],h=k(a,b,c,d,B,n,g),B[l]=!B[l],!h){u=-q-r*f;for(h=1;h<=a;h++)u+=g[h]*e[h];v<u&&(v=u,B[l]=!B[l])}h=k(a,b,c,d,B,n,g);return v}function d(a,b,c){var d=a.F;a=b.h;b.Gb[c]=2;b.He=1;b.Af[1]=c;dg(b.ab);cg(b.ab,c,1);for(c=d.o[c].l;null!=c;c=c.G)cg(b.ab,a+c.g.H,-c.j);b.zf=0}function e(a){var b,c;for(b=1;b<=a.ab.O;b++)c=a.ab.ca[b],0==a.ac[c]&&0==a.Bb[c]&&a.c[c]==a.f[c]&&(a.zf-=a.ab.j[b]*a.c[c],a.ab.j[b]=0);eg(a.ab,2.220446049250313E-16)}function f(a){var b,
c,d,e;for(b=1;b<=a.ab.O;b++)c=a.ab.ca[b],a.fb[c]||(d=a.ac[c],e=0==d?a.c[c]==-t?t:a.x[c]-a.c[c]:a.x[c]-a.c[c]*a.x[d],d=a.Bb[c],d=0==d?a.Bb[c]==+t?t:a.f[c]-a.x[c]:a.f[c]*a.x[d]-a.x[c],a.ob[c]=e<=d?jg:kg)}function g(a){var b,c,d,e;fg(a.sa,a.ab);a.tc=a.zf;for(b=a.sa.O;1<=b;b--)d=a.sa.ca[b],a.fb[d]||(a.ob[d]==jg?(e=a.ac[d],0==e?a.tc-=a.sa.j[b]*a.c[d]:(c=a.sa.Na[e],0==c&&(cg(a.sa,e,1),c=a.sa.Na[e],a.sa.j[c]=0),a.sa.j[c]+=a.sa.j[b]*a.c[d])):a.ob[d]==kg&&(e=a.Bb[d],0==e?a.tc-=a.sa.j[b]*a.f[d]:(c=a.sa.Na[e],
0==c&&(cg(a.sa,e,1),c=a.sa.Na[e],a.sa.j[c]=0),a.sa.j[c]+=a.sa.j[b]*a.f[d]),a.sa.j[b]=-a.sa.j[b]));for(b=1;b<=a.sa.O;b++)d=a.sa.ca[b],a.fb[d]&&(Math.abs(a.c[d])<=Math.abs(a.f[d])?(a.ob[d]=jg,a.tc-=a.sa.j[b]*a.c[d]):(a.ob[d]=kg,a.tc-=a.sa.j[b]*a.f[d],a.sa.j[b]=-a.sa.j[b]))}function k(a){var b=a.h,d=a.n,e,f,g,h,k,l,m;k=0;fg(a.J,a.sa);a.Nb=a.tc;eg(a.J,2.220446049250313E-16);for(e=1;e<=a.J.O;e++)f=a.J.ca[e],!a.fb[f]&&0<a.J.j[e]&&(a.J.j[e]=0);eg(a.J,0);h=0;for(e=1;e<=a.J.O;e++)f=a.J.ca[e],a.fb[f]&&(h++,
g=a.J.ca[h],a.J.Na[f]=h,a.J.Na[g]=e,a.J.ca[h]=f,a.J.ca[e]=g,f=a.J.j[h],a.J.j[h]=a.J.j[e],a.J.j[e]=f);if(0==h)return k;l=new Float64Array(1+h);g=new Float64Array(1+h);m=new Float64Array(1+h);for(e=1;e<=h;e++)f=a.J.ca[e],l[e]=a.f[f]-a.c[f],a.ob[f]==jg?g[e]=a.x[f]-a.c[f]:a.ob[f]==kg&&(g[e]=a.f[f]-a.x[f]),0>g[e]&&(g[e]=0);k=0;for(e=h+1;e<=a.J.O;e++)f=a.J.ca[e],a.ob[f]==jg?(g=a.ac[f],g=0==g?a.x[f]-a.c[f]:a.x[f]-a.c[f]*a.x[g]):a.ob[f]==kg&&(g=a.Bb[f],g=0==g?a.f[f]-a.x[f]:a.f[f]*a.x[g]-a.x[f]),0>g&&(g=0),
k-=a.J.j[e]*g;k=c(h,a.J.j,a.Nb,l,g,k,m);if(0==k)return k;for(e=1;e<=h;e++)a.J.j[e]=m[e];for(e=h+1;e<=a.J.O;e++)f=a.J.ca[e],f<=b+d&&(a.J.j[e]*=0);a.Nb=null;return k}function h(a){var b,c,d,e;for(b=1;b<=a.J.O;b++)d=a.J.ca[b],a.fb[d]&&(a.ob[d]==jg?a.Nb+=a.J.j[b]*a.c[d]:a.ob[d]==kg&&(a.Nb-=a.J.j[b]*a.f[d],a.J.j[b]=-a.J.j[b]));for(b=1;b<=a.J.O;b++)d=a.J.ca[b],a.fb[d]||(a.ob[d]==jg?(e=a.ac[d],0==e?a.Nb+=a.J.j[b]*a.c[d]:(c=a.J.Na[e],0==c&&(cg(a.J,e,1),c=a.J.Na[e],a.J.j[c]=0),a.J.j[c]-=a.J.j[b]*a.c[d])):
a.ob[d]==kg&&(e=a.Bb[d],0==e?a.Nb-=a.J.j[b]*a.f[d]:(c=a.J.Na[e],0==c&&(cg(a.J,e,1),c=a.J.Na[e],a.J.j[c]=0),a.J.j[c]+=a.J.j[b]*a.f[d]),a.J.j[b]=-a.J.j[b]))}function l(a,b){var c=a.F,d=b.h,e,f,g,h;for(f=b.J.O;1<=f;f--)if(e=b.J.ca[f],!(e>d)){for(e=c.o[e].l;null!=e;e=e.G)g=d+e.g.H,h=b.J.Na[g],0==h&&(cg(b.J,g,1),h=b.J.Na[g],b.J.j[h]=0),b.J.j[h]+=b.J.j[f]*e.j;b.J.j[f]=0}eg(b.J,0)}function n(a,b){var c=b.h,d=b.n,e,f,g=new Int32Array(1+d),h=new Float64Array(1+d);f=0;for(d=b.J.O;1<=d;d--)e=b.J.ca[d],f++,g[f]=
e-c,h[f]=b.J.j[d];Id(a,Cf,f,g,h,Ta,b.Nb)}function m(a,b){var c=a.F,d=b.h,e=b.n,f,g,h,k=0,l=0,m,p=0;for(f=1;f<=b.ab.O;f++)g=b.ab.ca[f],g<=d||b.fb[g]||.001>Math.abs(b.ab.j[f])||(h=b.ac[g],m=0==h?b.c[g]==-t?t:b.x[g]-b.c[g]:b.x[g]-b.c[g]*b.x[h],h=b.Bb[g],h=0==h?b.Bb[g]==+t?t:b.f[g]-b.x[g]:b.f[g]*b.x[h]-b.x[g],m=m<=h?m:h,!(.001>m)&&p<m&&(p=m,k=g));if(0==k)return 1;for(g=1;g<=d;g++)if(!b.Gb[g]){for(f=c.o[g].l;null!=f&&f.g.H!=k-d;f=f.G);if(null!=f&&.001<=Math.abs(f.j))break}if(g>d)return 2;b.He++;b.Af[b.He]=
g;b.Gb[g]=2;e=bg(d+e);cg(e,g,1);for(f=c.o[g].l;null!=f;f=f.G)cg(e,d+f.g.H,-f.j);f=b.ab.Na[k];c=b.ab;d=-b.ab.j[f]/e.j[e.Na[k]];for(g=1;g<=e.O;g++)f=e.ca[g],p=void 0,p=c.Na[f],p=0==p?0:c.j[p],m=e.j[g],cg(c,f,p+d*m);cg(b.ab,k,0);return l}var q,r,p=b.h,u=b.n,v,H,E;(function(a,b){var c=a.F,d=b.h,e=b.n,f;for(f=1;f<=d;f++)b.x[f]=c.o[f].w;for(f=d+1;f<=d+e;f++)b.x[f]=c.g[f-d].w})(a,b);ja(b.ob,1,ig,p+u);for(v=1;v<=p;v++)if(!b.Gb[v]){for(d(a,b,v);;){e(b);if(gg)for(H=1;H<=p+u;H++);f(b);g(b);E=k(b);0<E&&(h(b),
l(a,b),n(a,b));for(var B=1;B<=b.sa.O;B++)H=b.sa.ca[B],b.ob[H]=ig;if(!(0==E&&b.He<hg&&0==m(a,b)))break}for(H=1;H<=b.He;H++)E=b.Af[H],b.Gb[E]=0}}
function Rf(a){function b(a,b){var c;switch(pb(a,b)-Ka+ef){case ef:case jf:c=-t;break;case gf:case lf:case af:c=If(a,b)}return c}function c(a,b){var c;switch(pb(a,b)-Ka+ef){case ef:case gf:c=+t;break;case jf:case lf:case af:c=Hf(a,b)}return c}function d(a,b){var c;switch(sb(a,b)-Ka+ef){case ef:case jf:c=-t;break;case gf:case lf:case af:c=Jf(a,b)}return c}function e(a,b){var c;switch(sb(a,b)-Ka+ef){case ef:case gf:c=+t;break;case jf:case lf:case af:c=Mf(a,b)}return c}function f(a,b){return(Ic(a,b)==
Ma?Kf:Lf)==Lf&&sb(a,b)-Ka+ef==lf&&0==Jf(a,b)&&1==Mf(a,b)}function g(a,b,c,f){var g,h,k;k=0;for(h=1;h<=b;h++)if(g=c[h],0<f[h]){g=d(a,g);if(g==-t){k=-t;break}k+=f[h]*g}else if(0>f[h]){g=e(a,g);if(g==+t){k=-t;break}k+=f[h]*g}return k}function k(a,b,c,f){var g,h,k;k=0;for(h=1;h<=b;h++)if(g=c[h],0<f[h]){g=e(a,g);if(g==+t){k=+t;break}k+=f[h]*g}else if(0>f[h]){g=d(a,g);if(g==-t){k=+t;break}k+=f[h]*g}return k}function h(a,b,c,d,e,f,g,h){b!=-t&&g&&(b-=a[f]);c!=+t&&g&&(c-=a[f]);d!=-t&&(0>a[f]&&(d-=a[f]),0>
a[h]&&(d-=a[h]));e!=+t&&(0<a[f]&&(e-=a[f]),0<a[h]&&(e-=a[h]));f=0<a[h]?b==-t||e==+t?-t:(b-e)/a[h]:c==+t||d==-t?-t:(c-d)/a[h];if(.001<f)return 2;f=0<a[h]?c==+t||d==-t?+t:(c-d)/a[h]:b==-t||e==+t?+t:(b-e)/a[h];return.999>f?1:0}var l=null,n,m,q,r,p,u,v,H,E,B,J,R,T,O,S,G;y("Creating the conflict graph...");n=kb(a);m=lb(a);q=0;B=new Int32Array(1+m);J=new Int32Array(1+m);E=new Int32Array(1+m);G=new Float64Array(1+m);for(r=1;r<=n;r++)if(R=b(a,r),T=c(a,r),R!=-t||T!=+t)if(H=vb(a,r,E,G),!(500<H))for(O=g(a,H,
E,G),S=k(a,H,E,G),u=1;u<=H;u++)if(f(a,E[u]))for(v=u+1;v<=H;v++)f(a,E[v])&&(h(G,R,T,O,S,u,0,v)||h(G,R,T,O,S,u,1,v))&&(p=E[u],0==B[p]&&(q++,B[p]=q,J[q]=p),p=E[v],0==B[p]&&(q++,B[p]=q,J[q]=p));if(0==q||4E3<q)return y("The conflict graph is either empty or too big"),l;l={};l.n=m;l.Eb=q;l.zg=0;l.uf=B;l.de=J;H=q+q;H=(H*(H-1)/2+0)/1;l.Jc=Array(H);for(p=1;p<=q;p++)lg(l,+J[p],-J[p]);for(r=1;r<=n;r++)if(R=b(a,r),T=c(a,r),R!=-t||T!=+t)if(H=vb(a,r,E,G),!(500<H))for(O=g(a,H,E,G),S=k(a,H,E,G),u=1;u<=H;u++)if(f(a,
E[u]))for(v=u+1;v<=H;v++)if(f(a,E[v])){switch(h(G,R,T,O,S,u,0,v)){case 1:lg(l,-E[u],+E[v]);break;case 2:lg(l,-E[u],-E[v])}switch(h(G,R,T,O,S,u,1,v)){case 1:lg(l,+E[u],+E[v]);break;case 2:lg(l,+E[u],-E[v])}}y("The conflict graph has 2*"+l.Eb+" vertices and "+l.zg+" edges");return l}function lg(a,b,c){var d;0<b?b=a.uf[b]:(b=a.uf[-b],b+=a.Eb);0<c?c=a.uf[c]:(c=a.uf[-c],c+=a.Eb);b<c&&(d=b,b=c,c=d);d=(b-1)*(b-2)/2+(c-1);a.Jc[d/1]|=1<<0-d%1;a.zg++}
function Nf(a,b,c,d){function e(a,b,c){return b==c?0:b>c?f(a,b*(b-1)/2+c):f(a,c*(c-1)/2+b)}function f(a,b){return a.Jc[b/1]&1<<0-b%1}function g(a,b,c,d,f,h){var k,l,m,p,n,q,r,ba;ba=new Int32Array(a.n);if(0>=b){if(0==b&&(a.set[d++]=c[0],f+=h),f>a.fd)for(a.fd=f,a.Yf=d,k=0;k<d;k++)a.jh[k+1]=a.set[k]}else for(k=b;0<=k&&!(0==d&&k<b);k--){m=c[k];if(0<d&&a.sg[m]<=a.fd-f)break;a.set[d]=m;p=f+a.Ic[m+1];h-=a.Ic[m+1];if(h<=a.fd-p)break;for(n=r=q=0;r<c+k;)l=c[r],r++,e(a,l,m)&&(ba[q]=l,q++,n+=a.Ic[l+1]);n<=a.fd-
p||g(a,q-1,ba,d+1,p,n)}}var k=lb(a),h,l,n,m=0,q,r,p;n=new Int32Array(1+2*b.Eb);q=new Int32Array(1+2*b.Eb);p=new Float64Array(1+k);for(l=1;l<=b.Eb;l++)h=b.de[l],h=Dc(a,h),h=100*h+.5|0,0>h&&(h=0),100<h&&(h=100),n[l]=h,n[b.Eb+l]=100-h;n=function(a,b,c,d){var f={},h,k,l,m,p,n;f.n=a;f.Ic=b;f.Jc=c;f.fd=0;f.Yf=0;f.jh=d;f.sg=new Int32Array(f.n);f.set=new Int32Array(f.n);p=new Int32Array(f.n);n=new Int32Array(f.n);b=new Int32Array(f.n);c=la();for(a=0;a<f.n;a++)for(h=n[a]=0;h<f.n;h++)e(f,a,h)&&(n[a]+=f.Ic[h+
1]);for(a=0;a<f.n;a++)p[a]=0;for(a=f.n-1;0<=a;a--){m=l=-1;for(h=0;h<f.n;h++)!p[h]&&(f.Ic[h+1]>l||f.Ic[h+1]==l&&n[h]>m)&&(l=f.Ic[h+1],m=n[h],k=h);b[a]=k;p[k]=1;for(h=0;h<f.n;h++)!p[h]&&h!=k&&e(f,k,h)&&(n[h]-=f.Ic[k+1])}for(a=k=0;a<f.n;a++)k+=f.Ic[b[a]+1],g(f,a,b,0,0,k),f.sg[b[a]]=f.fd,4.999<=ma(c)&&(y("level = "+a+1+" ("+f.n+"); best = "+f.fd+""),c=la());for(a=1;a<=f.Yf;a++)d[a]++;return f.Yf}(2*b.Eb,n,b.Jc,q);r=0;for(l=1;l<=n;l++)h=q[l],h<=b.Eb?(h=b.de[h],h=Dc(a,h),r+=h):(h=b.de[h-b.Eb],h=Dc(a,h),
r+=1-h);if(1.01<=r){for(l=a=1;l<=n;l++)h=q[l],h<=b.Eb?(h=b.de[h],p[h]+=1):(h=b.de[h-b.Eb],--p[h],--a);for(h=1;h<=k;h++)0!=p[h]&&(m++,c[m]=h,d[m]=p[h]);c[0]=0;d[0]=a}return m}
function ag(a,b){var c;if(a.u.Lb==Zc){var d,e;for(d=1;d<=a.n&&!a.$c[d];d++);e=Dc(a.F,d);b(e-Math.floor(e)<Math.ceil(e)-e?zf:Af);c=d}else if(a.u.Lb==$c){for(d=a.n;1<=d&&!a.$c[d];d--);e=Dc(a.F,d);b(e-Math.floor(e)<Math.ceil(e)-e?zf:Af);c=d}else if(a.u.Lb==ad)c=mg(a,b);else if(a.u.Lb==bd){c=a.F;var f=c.h,g=c.n,k=a.$c,h,l,n,m,q,r,p,u,v,H,E,B,J,R;xc(c);p=new Int32Array(1+g);R=new Float64Array(1+g);l=0;J=-1;for(h=1;h<=g;h++)if(k[h]){u=Dc(c,h);r=Bd(c,f+h,p,R);for(q=-1;1>=q;q+=2){n=Fd(c,r,p,R,q,1E-9);0!=
n&&(n=p[n]);if(0==n)n=a.F.dir==za?+t:-t;else{for(m=1;m<=r&&p[m]!=n;m++);m=R[m];v=(0>q?Math.floor(u):Math.ceil(u))-u;v/=m;n>f&&Ic(c,n-f)!=Ma&&.001<Math.abs(v-Math.floor(v+.5))&&(v=0<v?Math.ceil(v):Math.floor(v));n<=f?(m=zc(c,n),n=Bc(c,n)):(m=Cc(c,n-f),n=Ec(c,n-f));switch(a.F.dir){case za:if(m==M&&0>n||m==P&&0<n||m==Ra)n=0;break;case Ea:if(m==M&&0<n||m==P&&0>n||m==Ra)n=0}n=n*v}0>q?e=n:H=n}if(J<Math.abs(e)||J<Math.abs(H))if(l=h,Math.abs(e)<Math.abs(H)?(d=zf,J=Math.abs(H)):(d=Af,J=Math.abs(e)),E=e,B=
H,J==t)break}J<1E-6*(1+.001*Math.abs(c.ea))?c=l=mg(a,b):(a.u.s>=mc&&(y("branch_drtom: column "+l+" chosen to branch on"),Math.abs(E)==t?y("branch_drtom: down-branch is infeasible"):y("branch_drtom: down-branch bound is "+(yc(c)+E)+""),Math.abs(B)==t?y("branch_drtom: up-branch   is infeasible"):y("branch_drtom: up-branch   bound is "+(yc(c)+B)+"")),b(d),c=l)}else a.u.Lb==cd&&(c=ng(a,b));return c}
function mg(a,b){var c,d,e,f,g,k;d=0;g=t;for(c=1;c<=a.n;c++)a.$c[c]&&(f=Dc(a.F,c),k=Math.floor(f)+.5,g>Math.abs(f-k)&&(d=c,g=Math.abs(f-k),e=f<k?zf:Af));b(e);return d}function og(a){a=a.n;var b,c={};c.wd=new Int32Array(1+a);c.Sd=new Float64Array(1+a);c.Hd=new Int32Array(1+a);c.we=new Float64Array(1+a);for(b=1;b<=a;b++)c.wd[b]=c.Hd[b]=0,c.Sd[b]=c.we[b]=0;return c}
function Zf(a){var b,c,d=a.Ed;null!=a.R.V&&(b=a.R.V.Sc,c=a.F.g[b].w-a.R.V.pg,a=a.F.ea-a.R.V.rc,a=Math.abs(a/c),0>c?(d.wd[b]++,d.Sd[b]+=a):(d.Hd[b]++,d.we[b]+=a))}
function ng(a,b){function c(a,b,c){var d,e;xc(a);d=Ba();hb(d,a,0);Va(d,b,C,c,c);b=new kc;b.s=lc;b.hb=Ub;b.pc=30;b.cb=1E3;b.hb=Ub;b=sc(d,b);0==b||b==pg?tc(d)==jc?e=t:uc(d)==ec?(a.dir==za?e=d.ea-a.ea:a.dir==Ea&&(e=a.ea-d.ea),e<1E-6*(1+.001*Math.abs(a.ea))&&(e=0)):e=0:e=0;return e}function d(a,b,d){var e=a.Ed,f;if(d==zf){if(0==e.wd[b]){d=a.F.g[b].w;a=c(a.F,b,Math.floor(d));if(a==t)return f=t;e.wd[b]=1;e.Sd[b]=a/(d-Math.floor(d))}f=e.Sd[b]/e.wd[b]}else if(d==Af){if(0==e.Hd[b]){d=a.F.g[b].w;a=c(a.F,b,
Math.ceil(d));if(a==t)return f=t;e.Hd[b]=1;e.we[b]=a/(Math.ceil(d)-d)}f=e.we[b]/e.Hd[b]}return f}function e(a){var b=a.Ed,c,d=0,e=0;for(c=1;c<=a.n;c++)Jd(a,c)&&(d++,0<b.wd[c]&&0<b.Hd[c]&&e++);y("Pseudocosts initialized for "+e+" of "+d+" variables")}var f=la(),g,k,h,l,n,m,q;null==a.Ed&&(a.Ed=og(a));k=0;q=-1;for(g=1;g<=a.n;g++)if(Jd(a,g)){l=a.F.g[g].w;n=d(a,g,zf);if(n==t)return k=g,h=zf,b(h),k;m=n*(l-Math.floor(l));n=d(a,g,Af);if(n==t)return k=g,h=Af,b(h),k;l=n*(Math.ceil(l)-l);n=m>l?m:l;q<n&&(q=n,
k=g,h=m<=l?zf:Af);a.u.s>=bb&&10<=ma(f)&&(e(a),f=la())}if(0==q)return k=mg(a,b);b(h);return k}
function Xf(a){var b=a.F,c=b.n,d=null,e=null,f=null,g,k,h,l,n,m,q,r;for(l=0;;){var p=null;switch(l){case 0:xc(b);if(0!=a.R.level||1!=a.R.ag){p=5;break}q=0;for(h=1;h<=c;h++)if(g=b.g[h],g.kind!=Ma&&g.type!=C)if(g.type==Q&&0==g.c&&1==g.f)q++;else{a.u.s>=Xb&&y("FPUMP heuristic cannot be applied due to general integer variables");p=5;break}if(null!=p)break;if(0==q){p=5;break}a.u.s>=Xb&&y("Applying FPUMP heuristic...");e=Array(1+q);ka(e,1,q);l=0;for(h=1;h<=c;h++)g=b.g[h],g.kind==Fc&&g.type==Q&&(e[++l].H=
h);d=Ba();case 1:hb(d,b,cb);if(b.Da==ec){La(d,1);n=new Int32Array(1+c);m=new Float64Array(1+c);for(h=1;h<=c;h++)n[h]=h,m[h]=b.g[h].B;Ya(d,d.h,c,n,m);n=.1*b.ea+.9*b.xa;b.dir==za?Ua(d,d.h,Ta,0,n-b.la):b.dir==Ea&&Ua(d,d.h,Sa,n-b.la,0)}m=0;for(l=1;l<=q;l++)e[l].x=-1;case 2:if(m++,a.u.s>=Xb&&y("Pass "+m+""),r=t,n=0,1<m){null==f&&(f=qg());for(l=1;l<=q;l++)h=e[l].H,g=d.g[h],p=rg(f),0>p&&(p=0),g=Math.abs(e[l].x-g.w),.5<g+p&&(e[l].x=1-e[l].x);p=4;break}case 3:for(l=k=1;l<=q;l++)g=d.g[e[l].H],g=.5>g.w?0:1,
e[l].x!=g&&(k=0,e[l].x=g);if(k){for(l=1;l<=q;l++)g=d.g[e[l].H],e[l].d=Math.abs(g.w-e[l].x);na(e,q,function(a,b){return a.d>b.d?-1:a.d<b.d?1:0});for(l=1;l<=q&&!(5<=l&&.35>e[l].d||10<=l);l++)e[l].x=1-e[l].x}case 4:if(2147483647>a.u.ub&&a.u.ub-1<=1E3*ma(a.ic)){p=5;break}d.dir=za;d.la=0;for(h=1;h<=c;h++)d.g[h].B=0;for(l=1;l<=q;l++)h=e[l].H,0==e[l].x?d.g[h].B=1:(d.g[h].B=-1,d.la+=1);k=new kc;a.u.s<=Mb?k.s=a.u.s:a.u.s<=Xb&&(k.s=fc,k.cb=1E4);l=sc(d,k);if(0!=l){a.u.s>=Mb&&y("Warning: glp_simplex returned "+
l+"");p=5;break}l=xc(d);if(l!=vc){a.u.s>=Mb&&y("Warning: glp_get_status returned "+l+"");p=5;break}a.u.s>=mc&&y("delta = "+d.ea+"");h=.3*a.u.Xb;for(l=1;l<=q&&!(g=d.g[e[l].H],h<g.w&&g.w<1-h);l++);if(l>q){g=new Float64Array(1+c);for(h=1;h<=c;h++)g[h]=d.g[h].w,b.g[h].kind==Fc&&(g[h]=Math.floor(g[h]+.5));d.la=b.la;d.dir=b.dir;for(l=1;l<=q;l++)d.g[e[l].H].c=g[e[l].H],d.g[e[l].H].f=g[e[l].H],d.g[e[l].H].type=C;for(h=1;h<=c;h++)d.g[h].B=b.g[h].B;l=sc(d,k);if(0!=l){a.u.s>=Mb&&y("Warning: glp_simplex returned "+
l+"");p=5;break}l=xc(d);if(l!=vc){a.u.s>=Mb&&y("Warning: glp_get_status returned "+l+"");p=5;break}for(h=1;h<=c;h++)b.g[h].kind!=Fc&&(g[h]=d.g[h].w);l=Kd(a,g);if(0==l){p=tf(a,a.R.bound)?1:5;break}}r==t||d.ea<=r-1E-6*(1+r)?(n=0,r=d.ea):n++;if(3>n){p=3;break}5>m&&(p=2)}if(null==p)break;l=p}}
function Yf(a){function b(a,b,c){var d,e=0,f=0,g=0;for(d=a.l;null!=d;d=d.next)c[d.H]=d.j,f+=d.j*d.j;for(d=b.l;null!=d;d=d.next)e+=c[d.H]*d.j,g+=d.j*d.j;for(d=a.l;null!=d;d=d.next)c[d.H]=0;a=Math.sqrt(f)*Math.sqrt(g);4.930380657631324E-32>a&&(a=2.220446049250313E-16);return e/a}var c,d,e,f,g,k,h,l,n,m;c=a.local;f=Array(1+c.size);l=new Int32Array(1+a.n);n=new Float64Array(1+a.n);m=new Float64Array(1+a.n);g=0;for(d=c.head;null!=d;d=d.next)g++,f[g].Pe=d,f[g].fa=0;for(g=1;g<=c.size;g++){var q=null,r=null;
d=f[g].Pe;k=h=0;for(e=d.l;null!=e;e=e.next)h++,l[h]=e.H,n[h]=e.j,k+=e.j*e.j;4.930380657631324E-32>k&&(k=2.220446049250313E-16);h=Dd(a.F,h,l,n);d=Gd(a.F,h,l,n,d.type,d.Zf,function(a,b,c,d,e,f){q=e;r=f});0==d?(f[g].Wc=Math.abs(q)/Math.sqrt(k),a.F.dir==za?(0>r&&(r=0),f[g].Cb=+r):(0<r&&(r=0),f[g].Cb=-r)):1==d?f[g].Wc=f[g].Cb=0:2==d&&(f[g].Wc=1,f[g].Cb=t);.01>f[g].Cb&&(f[g].Cb=0)}na(f,c.size,function(a,b){if(0==a.Cb&&0==b.Cb){if(a.Wc>b.Wc)return-1;if(a.Wc<b.Wc)return 1}else{if(a.Cb>b.Cb)return-1;if(a.Cb<
b.Cb)return 1}return 0});k=0==a.R.level?90:10;k>c.size&&(k=c.size);for(g=1;g<=k;g++)if(!(.01>f[g].Cb&&.01>f[g].Wc)){for(c=1;c<g&&!(f[c].fa&&.9<b(f[g].Pe,f[c].Pe,m));c++);if(!(c<g)){d=f[g].Pe;f[g].fa=1;c=La(a.F,1);null!=d.name&&Pa(a.F,c,d.name);a.F.o[c].qc=d.qc;h=0;for(e=d.l;null!=e;e=e.next)h++,l[h]=e.H,n[h]=e.j;Ya(a.F,c,h,l,n);Ua(a.F,c,d.type,d.Zf,d.Zf)}}}
function Pf(a){function b(a){var b,c;b=0;c=t;for(a=a.head;null!=a;a=a.next)c>a.V.Yc&&(b=a.p,c=a.V.Yc);return b}function c(a){var b,c,d,e,n;b=a.Ca[1].node;e=(a.F.xa-b.bound)/b.Yc;c=0;d=t;for(b=a.head;null!=b;b=b.next)n=b.V.bound+e*b.V.Yc,a.F.dir==Ea&&(n=-n),d>n&&(c=b.p,d=n);return c}function d(a){var b,c=null,d,e;switch(a.F.dir){case za:d=+t;for(b=a.head;null!=b;b=b.next)d>b.bound&&(d=b.bound);e=.001*(1+Math.abs(d));for(b=a.head;null!=b;b=b.next)b.bound<=d+e&&(null==c||c.V.Yc>b.V.Yc)&&(c=b);break;
case Ea:d=-t;for(b=a.head;null!=b;b=b.next)d<b.bound&&(d=b.bound);e=.001*(1+Math.abs(d));for(b=a.head;null!=b;b=b.next)b.bound>=d-e&&(null==c||c.rc<b.rc)&&(c=b)}return c.p}var e;a.u.lc==dd?e=a.$a.p:a.u.lc==ed?e=a.head.p:a.u.lc==fd?e=d(a):a.u.lc==gd&&(e=a.F.Da==Aa?b(a):c(a));return e}
var qa=exports.GLP_MAJOR_VERSION=4,ra=exports.GLP_MINOR_VERSION=49,za=exports.GLP_MIN=1,Ea=exports.GLP_MAX=2,Ma=exports.GLP_CV=1,Fc=exports.GLP_IV=2,Gc=exports.GLP_BV=3,Ka=exports.GLP_FR=1,Sa=exports.GLP_LO=2,Ta=exports.GLP_UP=3,Q=exports.GLP_DB=4,C=exports.GLP_FX=5,A=exports.GLP_BS=1,M=exports.GLP_NL=2,P=exports.GLP_NU=3,Ra=exports.GLP_NF=4,Na=exports.GLP_NS=5,Uc=exports.GLP_SF_GM=1,Vc=exports.GLP_SF_EQ=16,Wc=exports.GLP_SF_2N=32,Xc=exports.GLP_SF_SKIP=64,hc=exports.GLP_SF_AUTO=128,$b=exports.GLP_SOL=
1,le=exports.GLP_IPT=2,Sc=exports.GLP_MIP=3,Aa=exports.GLP_UNDEF=1,ec=exports.GLP_FEAS=2,Ad=exports.GLP_INFEAS=3,jc=exports.GLP_NOFEAS=4,vc=exports.GLP_OPT=5,wc=exports.GLP_UNBND=6,md=exports.GLP_BF_FT=1,rd=exports.GLP_BF_BG=2,sd=exports.GLP_BF_GR=3,lc=exports.GLP_MSG_OFF=0,Mb=exports.GLP_MSG_ERR=1,fc=exports.GLP_MSG_ON=2,Xb=exports.GLP_MSG_ALL=3,mc=exports.GLP_MSG_DBG=4,Pb=exports.GLP_PRIMAL=1,Rb=exports.GLP_DUALP=2,Ub=exports.GLP_DUAL=3,nc=exports.GLP_PT_STD=17,oc=exports.GLP_PT_PSE=34,pc=exports.GLP_RT_STD=
17,qc=exports.GLP_RT_HAR=34;exports.GLP_ORD_NONE=0;exports.GLP_ORD_QMD=1;exports.GLP_ORD_AMD=2;exports.GLP_ORD_SYMAMD=3;var Zc=exports.GLP_BR_FFV=1,$c=exports.GLP_BR_LFV=2,ad=exports.GLP_BR_MFV=3,bd=exports.GLP_BR_DTH=4,cd=exports.GLP_BR_PCH=5,dd=exports.GLP_BT_DFS=1,ed=exports.GLP_BT_BFS=2,fd=exports.GLP_BT_BLB=3,gd=exports.GLP_BT_BPH=4,hd=exports.GLP_PP_NONE=0,id=exports.GLP_PP_ROOT=1,jd=exports.GLP_PP_ALL=2;exports.GLP_RF_REG=0;
var Ha=exports.GLP_RF_LAZY=1,Ja=exports.GLP_RF_CUT=2,Bf=exports.GLP_RF_GMI=1,Cf=exports.GLP_RF_MIR=2,Df=exports.GLP_RF_COV=3,Ef=exports.GLP_RF_CLQ=4,bb=exports.GLP_ON=1,cb=exports.GLP_OFF=0,Ga=exports.GLP_IROWGEN=1,Vf=exports.GLP_IBINGO=2,Wf=exports.GLP_IHEUR=3,Ia=exports.GLP_ICUTGEN=4,$f=exports.GLP_IBRANCH=5,Of=exports.GLP_ISELECT=6,Sf=exports.GLP_IPREPRO=7,yf=exports.GLP_NO_BRNCH=0,zf=exports.GLP_DN_BRNCH=1,Af=exports.GLP_UP_BRNCH=2,Kb=exports.GLP_EBADB=1,Nb=exports.GLP_ESING=2,Ob=exports.GLP_ECOND=
3,rc=exports.GLP_EBOUND=4,Tb=exports.GLP_EFAIL=5,Tf=exports.GLP_EOBJLL=6,Uf=exports.GLP_EOBJUL=7,pg=exports.GLP_EITLIM=8,Qc=exports.GLP_ETMLIM=9,bc=exports.GLP_ENOPFS=10,cc=exports.GLP_ENODFS=11,Lc=exports.GLP_EROOT=12,Rc=exports.GLP_ESTOP=13,Pc=exports.GLP_EMIPGAP=14;exports.GLP_ENOFEAS=15;exports.GLP_ENOCVG=16;exports.GLP_EINSTAB=17;exports.GLP_EDATA=18;exports.GLP_ERANGE=19;exports.GLP_KKT_PE=1;exports.GLP_KKT_PB=2;exports.GLP_KKT_DE=3;exports.GLP_KKT_DB=4;exports.GLP_KKT_CS=5;
exports.GLP_MPS_DECK=1;exports.GLP_MPS_FILE=2;exports.GLP_ASN_MIN=1;exports.GLP_ASN_MAX=2;exports.GLP_ASN_MMP=3;function sg(a){var b=Math.floor(Math.log(a)/Math.log(2))+1;return Math.pow(2,.75>=a/Math.pow(2,b)?b-1:b)}function tg(a,b){var c=Number(a);if(isNaN(c))return 2;switch(c){case Number.POSITIVE_INFINITY:case Number.NEGATIVE_INFINITY:return 1;default:return b(c),0}}
function ug(a,b){var c=Number(a);if(isNaN(c))return 2;switch(c){case Number.POSITIVE_INFINITY:case Number.NEGATIVE_INFINITY:return 1;default:return 0==c%1?(b(c),0):2}}function vg(a,b,c){var d,e;if(!(1<=a&&31>=a&&1<=b&&12>=b&&1<=c&&4E3>=c))return-1;3<=b?b-=3:(b+=9,c--);d=c/100|0;c=(146097*d/4|0)+(1461*(c-100*d)/4|0);c+=(153*b+2)/5|0;c+=a+1721119;wg(c,function(a){e=a});a!=e&&(c=-1);return c}
function wg(a,b){var c,d,e;1721426<=a&&3182395>=a&&(a-=1721119,e=(4*a-1)/146097|0,c=(4*a-1)%146097/4|0,a=(4*c+3)/1461|0,c=((4*c+3)%1461+4)/4|0,d=(5*c-3)/153|0,c=(5*c-3)%153,c=(c+5)/5|0,e=100*e+a,9>=d?d+=3:(d-=9,e++),b(c,d,e))}var Ee=1;LPF_ECOND=2;LPF_ELIMIT=3;var we=0;function Le(a,b,c,d){var e=a.n,f=a.Ld,g=a.Kd,k=a.Zb;a=a.$b;var h,l,n,m;for(h=1;h<=e;h++){m=0;l=f[h];for(n=l+g[h];l<n;l++)m+=a[l]*d[k[l]];b[h+c]+=-1*m}}
function Je(a,b,c,d){var e=a.n,f=a.Nd,g=a.Md,k=a.Zb;a=a.$b;var h,l,n,m;for(h=1;h<=e;h++){m=0;l=f[h];for(n=l+g[h];l<n;l++)m+=a[l]*d[k[l]];b[h+c]+=-1*m}}if(we)var check_error=function(a,b,c,d){var e=a.h;a=a.yf;var f,g,k=0,h,l,n;for(f=1;f<=e;f++){h=0;for(g=n=1;g<=e;g++)l=b?a[e*(g-1)+f]*c[g]:a[e*(f-1)+g]*c[g],n<Math.abs(l)&&(n=Math.abs(l)),h+=l;g=Math.abs(h-d[f])/n;k<g&&(k=g)}1E-8<k&&y((b?"lpf_btran":"lpf_ftran")+": dmax = "+k+"; relative error too large")};exports.LPX_LP=100;exports.LPX_MIP=101;
var ef=exports.LPX_FR=110,gf=exports.LPX_LO=111,jf=exports.LPX_UP=112,lf=exports.LPX_DB=113,af=exports.LPX_FX=114;exports.LPX_MIN=120;exports.LPX_MAX=121;exports.LPX_P_UNDEF=132;exports.LPX_P_FEAS=133;exports.LPX_P_INFEAS=134;exports.LPX_P_NOFEAS=135;exports.LPX_D_UNDEF=136;exports.LPX_D_FEAS=137;exports.LPX_D_INFEAS=138;exports.LPX_D_NOFEAS=139;var df=exports.LPX_BS=140,hf=exports.LPX_NL=141,kf=exports.LPX_NU=142,ff=exports.LPX_NF=143,mf=exports.LPX_NS=144;exports.LPX_T_UNDEF=150;
exports.LPX_T_OPT=151;var Kf=exports.LPX_CV=160,Lf=exports.LPX_IV=161;exports.LPX_I_UNDEF=170;exports.LPX_I_OPT=171;exports.LPX_I_FEAS=172;exports.LPX_I_NOFEAS=173;exports.LPX_OPT=180;exports.LPX_FEAS=181;exports.LPX_INFEAS=182;exports.LPX_NOFEAS=183;exports.LPX_UNBND=184;exports.LPX_UNDEF=185;exports.LPX_E_OK=200;exports.LPX_E_EMPTY=201;exports.LPX_E_BADB=202;exports.LPX_E_INFEAS=203;exports.LPX_E_FAULT=204;exports.LPX_E_OBJLL=205;exports.LPX_E_OBJUL=206;exports.LPX_E_ITLIM=207;
exports.LPX_E_TMLIM=208;exports.LPX_E_NOFEAS=209;exports.LPX_E_INSTAB=210;exports.LPX_E_SING=211;exports.LPX_E_NOCONV=212;exports.LPX_E_NOPFS=213;exports.LPX_E_NODFS=214;exports.LPX_E_MIPGAP=215;var xg=exports.LPX_K_MSGLEV=300,yg=exports.LPX_K_SCALE=301,zg=exports.LPX_K_DUAL=302,Ag=exports.LPX_K_PRICE=303;exports.LPX_K_RELAX=304;exports.LPX_K_TOLBND=305;exports.LPX_K_TOLDJ=306;exports.LPX_K_TOLPIV=307;var Bg=exports.LPX_K_ROUND=308;exports.LPX_K_OBJLL=309;exports.LPX_K_OBJUL=310;
var Cg=exports.LPX_K_ITLIM=311,Dg=exports.LPX_K_ITCNT=312;exports.LPX_K_TMLIM=313;var Eg=exports.LPX_K_OUTFRQ=314;exports.LPX_K_OUTDLY=315;var Fg=exports.LPX_K_BRANCH=316,Gg=exports.LPX_K_BTRACK=317;exports.LPX_K_TOLINT=318;exports.LPX_K_TOLOBJ=319;
var Hg=exports.LPX_K_MPSINFO=320,Ig=exports.LPX_K_MPSOBJ=321,Jg=exports.LPX_K_MPSORIG=322,Kg=exports.LPX_K_MPSWIDE=323,Lg=exports.LPX_K_MPSFREE=324,Mg=exports.LPX_K_MPSSKIP=325,Ng=exports.LPX_K_LPTORIG=326,Og=exports.LPX_K_PRESOL=327,Pg=exports.LPX_K_BINARIZE=328,Qg=exports.LPX_K_USECUTS=329,Rg=exports.LPX_K_BFTYPE=330;exports.LPX_K_MIPGAP=331;exports.LPX_C_COVER=1;exports.LPX_C_CLIQUE=2;exports.LPX_C_GOMORY=4;exports.LPX_C_MIR=8;exports.LPX_C_ALL=255;
function If(a,b){var c=qb(a,b);c==-t&&(c=0);return c}function Hf(a,b){var c=rb(a,b);c==+t&&(c=0);return c}function bf(a,b,c){c(pb(a,b)-Ka+ef,If(a,b),Hf(a,b))}function Jf(a,b){var c=tb(a,b);c==-t&&(c=0);return c}function Mf(a,b){var c=ub(a,b);c==+t&&(c=0);return c}function $e(a,b,c){c(sb(a,b)-Ka+ef,Jf(a,b),Mf(a,b))}
function cf(a){var b=xg,c;null==a.ie&&(a.ie={},c=a.ie,c.s=3,c.scale=1,c.M=0,c.hh=1,c.th=.07,c.Ib=1E-7,c.vb=1E-7,c.ve=1E-9,c.round=0,c.ef=-t,c.ff=+t,c.pc=-1,c.ub=-1,c.dc=200,c.cb=0,c.Jg=2,c.Kg=3,c.Xb=1E-5,c.ue=1E-7,c.Sg=1,c.Tg=2,c.Ug=0,c.Wg=1,c.Rg=0,c.Vg=0,c.Qg=0,c.gh=0,c.qd=0,c.rh=0,c.ae=0);c=a.ie;var d=0;switch(b){case xg:d=c.s;break;case yg:d=c.scale;break;case zg:d=c.M;break;case Ag:d=c.hh;break;case Bg:d=c.round;break;case Cg:d=c.pc;break;case Dg:d=a.da;break;case Eg:d=c.dc;break;case Fg:d=c.Jg;
break;case Gg:d=c.Kg;break;case Hg:d=c.Sg;break;case Ig:d=c.Tg;break;case Jg:d=c.Ug;break;case Kg:d=c.Wg;break;case Lg:d=c.Rg;break;case Mg:d=c.Vg;break;case Ng:d=c.Qg;break;case Og:d=c.gh;break;case Pg:d=c.qd;break;case Qg:d=c.rh;break;case Rg:b={};eb(a,b);switch(b.type){case md:d=1;break;case rd:d=2;break;case sd:d=3}break;default:x("lpx_get_int_parm: parm = "+b+"; invalid parameter")}return d}var ye=1,Ae=2;
function ve(){var a={};a.N=a.n=0;a.valid=0;a.Nf=a.We=null;a.Wd=a.Vd=null;a.Fc=a.Ec=a.nd=null;a.wf=null;a.Dc=a.Cc=a.Qc=null;a.nb=a.xb=null;a.of=a.ke=null;a.Ka=0;a.Ja=a.Pa=0;a.yb=null;a.zb=null;a.kd=a.Vb=0;a.Gd=a.ld=null;a.vf=null;a.rf=a.$f=a.sf=null;a.Me=a.Oe=a.Ne=null;a.fa=null;a.xe=null;a.Ya=0;a.ec=.1;a.xc=4;a.hc=1;a.Ob=1E-15;a.sc=1E10;a.Yg=a.Wf=a.Sb=0;a.yg=a.pd=0;a.ta=0;return a}
function Ze(a){var b=a.n,c=a.Fc,d=a.Ec,e=a.nd,f=a.Dc,g=a.Cc,k=a.Qc,h=a.yb,l=a.zb,n=a.ld,m=1,q,r;for(r=a.kd;0!=r;r=n[r])if(r<=b){q=r;if(c[q]!=m)break;e[q]=d[q];m+=e[q]}else{q=r-b;if(f[q]!=m)break;k[q]=g[q];m+=k[q]}for(;0!=r;r=n[r])r<=b?(q=r,ha(h,m,h,c[q],d[q]),ha(l,m,l,c[q],d[q]),c[q]=m,e[q]=d[q],m+=e[q]):(q=r-b,ha(h,m,h,f[q],g[q]),ha(l,m,l,f[q],g[q]),f[q]=m,k[q]=g[q],m+=k[q]);a.Ja=m}
function Xe(a,b,c){var d=a.n,e=a.Fc,f=a.Ec,g=a.nd,k=a.Qc,h=a.yb,l=a.zb,n=a.Gd,m=a.ld,q=0,r;if(a.Pa-a.Ja<c&&(Ze(a),a.Pa-a.Ja<c))return 1;r=g[b];ha(h,a.Ja,h,e[b],f[b]);ha(l,a.Ja,l,e[b],f[b]);e[b]=a.Ja;g[b]=c;a.Ja+=c;0==n[b]?a.kd=m[b]:(c=n[b],c<=d?g[c]+=r:k[c-d]+=r,m[n[b]]=m[b]);0==m[b]?a.Vb=n[b]:n[m[b]]=n[b];n[b]=a.Vb;m[b]=0;0==n[b]?a.kd=b:m[n[b]]=b;a.Vb=b;return q}
function Ye(a,b,c){var d=a.n,e=a.nd,f=a.Dc,g=a.Cc,k=a.Qc,h=a.yb,l=a.zb,n=a.Gd,m=a.ld,q=0,r;if(a.Pa-a.Ja<c&&(Ze(a),a.Pa-a.Ja<c))return 1;r=k[b];ha(h,a.Ja,h,f[b],g[b]);ha(l,a.Ja,l,f[b],g[b]);f[b]=a.Ja;k[b]=c;a.Ja+=c;b=d+b;0==n[b]?a.kd=m[b]:(c=n[b],c<=d?e[c]+=r:k[c-d]+=r,m[n[b]]=m[b]);0==m[b]?a.Vb=n[b]:n[m[b]]=n[b];n[b]=a.Vb;m[b]=0;0==n[b]?a.kd=b:m[n[b]]=b;a.Vb=b;return q}
function Sg(a,b){var c=a.N;a.n=b;b<=c||(a.N=c=b+100,a.Nf=new Int32Array(1+c),a.We=new Int32Array(1+c),a.Wd=new Int32Array(1+c),a.Vd=new Int32Array(1+c),a.Fc=new Int32Array(1+c),a.Ec=new Int32Array(1+c),a.nd=new Int32Array(1+c),a.wf=new Float64Array(1+c),a.Dc=new Int32Array(1+c),a.Cc=new Int32Array(1+c),a.Qc=new Int32Array(1+c),a.nb=new Int32Array(1+c),a.xb=new Int32Array(1+c),a.of=new Int32Array(1+c),a.ke=new Int32Array(1+c),a.Gd=new Int32Array(1+c+c),a.ld=new Int32Array(1+c+c),a.vf=new Float64Array(1+
c),a.rf=new Int32Array(1+c),a.$f=new Int32Array(1+c),a.sf=new Int32Array(1+c),a.Me=new Int32Array(1+c),a.Oe=new Int32Array(1+c),a.Ne=new Int32Array(1+c),a.fa=new Int32Array(1+c),a.xe=new Float64Array(1+c))}
function Tg(a,b,c){var d=a.n,e=a.Wd,f=a.Vd,g=a.Fc,k=a.Ec,h=a.nd,l=a.Dc,n=a.Cc,m=a.Qc,q=a.nb,r=a.xb,p=a.of,u=a.ke,v=a.yb,H=a.zb,E=a.Gd,B=a.ld,J=a.vf,R=a.rf,T=a.$f,O=a.sf,S=a.Me,G=a.Oe,Z=a.Ne,Y=a.fa,ba=a.xe,oa=0,z,F,D,w,ca,L,K;w=1;ca=a.Ka+1;for(F=1;F<=d;F++)e[F]=ca,f[F]=0;for(z=1;z<=d;z++)k[z]=h[z]=0,Y[z]=0;f=e=0;for(F=1;F<=d;F++){var aa=q,N=ba;D=b(c,F,aa,N);0<=D&&D<=d||x("luf_factorize: j = "+F+"; len = "+D+"; invalid column length");if(ca-w<D)return oa=1;l[F]=w;n[F]=m[F]=D;e+=D;for(L=1;L<=D;L++)z=
aa[L],K=N[L],1<=z&&z<=d||x("luf_factorize: i = "+z+"; j = "+F+"; invalid row index"),Y[z]&&x("luf_factorize: i = "+z+"; j = "+F+"; duplicate element not allowed"),0==K&&x("luf_factorize: i = "+z+"; j = "+F+"; zero element not allowed"),v[w]=z,H[w]=K,w++,0>K&&(K=-K),f<K&&(f=K),Y[z]=1,h[z]++;for(L=1;L<=D;L++)Y[aa[L]]=0}for(z=1;z<=d;z++){D=h[z];if(ca-w<D)return oa=1;g[z]=w;w+=D}for(F=1;F<=d;F++)for(z=l[F],b=z+n[F]-1,h=z;h<=b;h++)z=v[h],K=H[h],c=g[z]+k[z],v[c]=F,H[c]=K,k[z]++;for(h=1;h<=d;h++)q[h]=r[h]=
p[h]=u[h]=h;a.Ja=w;a.Pa=ca;a.kd=d+1;a.Vb=d;for(z=1;z<=d;z++)E[z]=z-1,B[z]=z+1;E[1]=d+d;B[d]=0;for(F=1;F<=d;F++)E[d+F]=d+F-1,B[d+F]=d+F+1;E[d+1]=0;for(h=B[d+d]=1;h<=d;h++)Y[h]=0,ba[h]=0;a.Yg=e;a.Wf=0;a.Sb=e;a.yg=f;a.pd=f;a.ta=-1;for(z=1;z<=d;z++)J[z]=-1;for(D=0;D<=d;D++)R[D]=0;for(z=1;z<=d;z++)D=k[z],T[z]=0,O[z]=R[D],0!=O[z]&&(T[O[z]]=z),R[D]=z;for(D=0;D<=d;D++)S[D]=0;for(F=1;F<=d;F++)D=n[F],G[F]=0,Z[F]=S[D],0!=Z[F]&&(G[Z[F]]=F),S[D]=F;return oa}
function Ug(a,b){function c(){b(B,J);return 0==B}var d=a.n,e=a.Fc,f=a.Ec,g=a.Dc,k=a.Cc,h=a.yb,l=a.zb,n=a.vf,m=a.rf,q=a.sf,r=a.Me,p=a.Oe,u=a.Ne,v=a.ec,H=a.xc,E=a.hc,B,J,R,T,O,S,G,Z,Y,ba,oa,z,F,D,w,ca,L,K;B=J=0;ca=t;oa=0;Z=r[1];if(0!=Z)return B=h[g[Z]],J=Z,c();T=m[1];if(0!=T)return B=T,J=h[e[T]],c();for(R=2;R<=d;R++){for(Z=r[R];0!=Z;Z=z){T=g[Z];Y=T+k[Z]-1;z=u[Z];F=D=0;w=2147483647;for(ba=T;ba<=Y;ba++)if(T=h[ba],O=e[T],S=O+f[T]-1,!(f[T]>=w)){L=n[T];if(0>L){for(G=O;G<=S;G++)K=l[G],0>K&&(K=-K),L<K&&(L=
K);n[T]=L}for(G=e[T];h[G]!=Z;G++);K=l[G];0>K&&(K=-K);if(!(K<v*L)&&(F=T,D=Z,w=f[T],w<=R))return B=F,J=D,c()}if(0!=F){if(oa++,Z=(w-1)*(R-1),Z<ca&&(B=F,J=D,ca=Z),oa==H)return c()}else E&&(0==p[Z]?r[R]=u[Z]:u[p[Z]]=u[Z],0!=u[Z]&&(p[u[Z]]=p[Z]),p[Z]=u[Z]=Z)}for(T=m[R];0!=T;T=q[T]){O=e[T];S=O+f[T]-1;L=n[T];if(0>L){for(G=O;G<=S;G++)K=l[G],0>K&&(K=-K),L<K&&(L=K);n[T]=L}F=D=0;w=2147483647;for(G=O;G<=S;G++)if(Z=h[G],!(k[Z]>=w)&&(K=l[G],0>K&&(K=-K),!(K<v*L)&&(F=T,D=Z,w=k[Z],w<=R)))return B=F,J=D,c();if(0!=F&&
(oa++,Z=(R-1)*(w-1),Z<ca&&(B=F,J=D,ca=Z),oa==H))return c()}}return c()}
function Vg(a,b,c){var d=a.n,e=a.Wd,f=a.Vd,g=a.Fc,k=a.Ec,h=a.nd,l=a.wf,n=a.Dc,m=a.Cc,q=a.Qc,r=a.yb,p=a.zb,u=a.Gd,v=a.ld,H=a.vf,E=a.rf,B=a.$f,J=a.sf,R=a.Me,T=a.Oe,O=a.Ne,S=a.fa,G=a.xe,Z=a.Ob,Y=a.We,ba=0,oa,z,F,D,w,ca,L,K,aa,N,da,ea;0==B[b]?E[k[b]]=J[b]:J[B[b]]=J[b];0!=J[b]&&(B[J[b]]=B[b]);0==T[c]?R[m[c]]=O[c]:O[T[c]]=O[c];0!=O[c]&&(T[O[c]]=T[c]);K=g[b];aa=K+k[b]-1;for(z=K;r[z]!=c;z++);ea=l[b]=p[z];r[z]=r[aa];p[z]=p[aa];k[b]--;aa--;l=n[c];N=l+m[c]-1;for(F=l;r[F]!=b;F++);r[F]=r[N];m[c]--;N--;for(z=K;z<=
aa;z++){D=r[z];S[D]=1;G[D]=p[z];0==T[D]?R[m[D]]=O[D]:O[T[D]]=O[D];0!=O[D]&&(T[O[D]]=T[D]);ca=n[D];for(L=ca+m[D]-1;r[ca]!=b;ca++);r[ca]=r[L];m[D]--}for(;l<=N;){F=r[l];0==B[F]?E[k[F]]=J[F]:J[B[F]]=J[F];0!=J[F]&&(B[J[F]]=B[F]);D=g[F];oa=D+k[F]-1;for(w=D;r[w]!=c;w++);da=p[w]/ea;r[w]=r[oa];p[w]=p[oa];k[F]--;oa--;r[l]=r[N];m[c]--;N--;z=k[b];for(w=D;w<=oa;w++)if(D=r[w],S[D])if(ca=p[w]-=da*G[D],0>ca&&(ca=-ca),S[D]=0,z--,0==ca||ca<Z){r[w]=r[oa];p[w]=p[oa];k[F]--;w--;oa--;ca=n[D];for(L=ca+m[D]-1;r[ca]!=F;ca++);
r[ca]=r[L];m[D]--}else a.pd<ca&&(a.pd=ca);if(k[F]+z>h[F]){if(Xe(a,F,k[F]+z))return ba=1;K=g[b];aa=K+k[b]-1;l=n[c];N=l+m[c]-1}oa=0;for(z=K;z<=aa;z++)D=r[z],S[D]?(ca=L=-da*G[D],0>ca&&(ca=-ca),0==ca||ca<Z||(w=g[F]+k[F],r[w]=D,p[w]=L,k[F]++,Y[++oa]=D,a.pd<ca&&(a.pd=ca))):S[D]=1;for(w=1;w<=oa;w++){D=Y[w];if(m[D]+1>q[D]){if(Ye(a,D,m[D]+10))return ba=1;K=g[b];aa=K+k[b]-1;l=n[c];N=l+m[c]-1}ca=n[D]+m[D];r[ca]=F;m[D]++}B[F]=0;J[F]=E[k[F]];0!=J[F]&&(B[J[F]]=F);E[k[F]]=F;H[F]=-1;if(1>a.Pa-a.Ja){Ze(a);if(1>a.Pa-
a.Ja)return ba=1;K=g[b];aa=K+k[b]-1;l=n[c];N=l+m[c]-1}a.Pa--;r[a.Pa]=F;p[a.Pa]=da;f[b]++}q[c]=0;w=d+c;0==u[w]?a.kd=v[w]:v[u[w]]=v[w];0==v[w]?a.Vb=u[w]:u[v[w]]=u[w];e[b]=a.Pa;for(z=K;z<=aa;z++)if(D=r[z],S[D]=0,G[D]=0,1==m[D]||T[D]!=D||O[D]!=D)T[D]=0,O[D]=R[m[D]],0!=O[D]&&(T[O[D]]=D),R[m[D]]=D;return ba}
function Wg(a){var b=a.n,c=a.Fc,d=a.Ec,e=a.Dc,f=a.Cc,g=a.Qc,k=a.yb,h=a.zb,l=a.Gd,n=a.ld,m,q,r,p;p=0;for(m=1;m<=b;m++){q=c[m];for(r=q+d[m]-1;q<=r;q++)g[k[q]]++;p+=d[m]}a.Sb=p;if(a.Pa-a.Ja<p)return 1;for(p=1;p<=b;p++)e[p]=a.Ja,a.Ja+=g[p];for(m=1;m<=b;m++)for(q=c[m],r=q+d[m]-1;q<=r;q++)p=k[q],g=e[p]+f[p],k[g]=m,h[g]=h[q],f[p]++;for(c=b+1;c<=b+b;c++)l[c]=c-1,n[c]=c+1;l[b+1]=a.Vb;n[a.Vb]=b+1;n[b+b]=0;a.Vb=b+b;return 0}
function Xg(a){var b=a.n,c=a.Nf,d=a.We,e=a.Wd,f=a.Vd,g=a.yb,k=a.zb,h,l,n,m;for(h=1;h<=b;h++)d[h]=0;h=0;for(l=1;l<=b;l++){n=e[l];for(m=n+f[l]-1;n<=m;n++)d[g[n]]++;h+=f[l]}a.Wf=h;if(a.Pa-a.Ja<h)return 1;for(h=1;h<=b;h++)c[h]=a.Pa,a.Pa-=d[h];for(l=1;l<=b;l++)for(n=e[l],m=n+f[l]-1;n<=m;n++)h=g[n],a=--c[h],g[a]=l,k[a]=k[n];return 0}
function xe(a,b,c,d){function e(){0<a.Ya&&(a.Ka=a.Ya,a.yb=new Int32Array(1+a.Ka),a.zb=new Float64Array(1+a.Ka),a.Ya=0);if(Tg(a,c,d))return a.Ya=a.Ka+a.Ka,!0;for(q=1;q<=b;q++){if(Ug(a,function(a,b){r=a;p=b}))return a.ta=q-1,v=ye,!1;n=g[r];m=k[p];u=f[q];f[n]=u;g[u]=n;f[q]=r;g[r]=q;u=h[q];h[m]=u;k[u]=m;h[q]=p;k[p]=q;if(Vg(a,r,p))return a.Ya=a.Ka+a.Ka,!0;if(a.pd>l*a.yg)return a.ta=q-1,v=Ae,!1}Ze(a);return Wg(a)||Xg(a)?(a.Ya=a.Ka+a.Ka,!0):!1}var f,g,k,h,l=a.sc,n,m,q,r,p,u,v=null;1>b&&x("luf_factorize: n = "+
b+"; invalid parameter");1E8<b&&x("luf_factorize: n = "+b+"; matrix too big");a.valid=0;Sg(a,b);f=a.nb;g=a.xb;k=a.of;h=a.ke;0==a.Ka&&0==a.Ya&&(a.Ya=5*(b+10));for(;e(););if(null!=v)return v;a.valid=1;a.ta=b;v=0;u=3*(b+a.Sb)+2*a.Wf;if(a.Ka<u)for(a.Ya=a.Ka;a.Ya<u;)q=a.Ya,a.Ya=q+q;return v}
function Ge(a,b,c){var d=a.n,e=a.Nf,f=a.We,g=a.Wd,k=a.Vd,h=a.nb,l=a.yb,n=a.zb,m;a.valid||x("luf_f_solve: LU-factorization is not valid");if(b)for(;1<=d;d--){if(m=h[d],a=c[m],0!=a)for(b=e[m],m=b+f[m]-1;b<=m;b++)c[l[b]]-=n[b]*a}else for(e=1;e<=d;e++)if(m=h[e],a=c[m],0!=a)for(b=g[m],m=b+k[m]-1;b<=m;b++)c[l[b]]-=n[b]*a}
function Ie(a,b,c){var d=a.n,e=a.Fc,f=a.Ec,g=a.wf,k=a.Dc,h=a.Cc,l=a.nb,n=a.ke,m=a.yb,q=a.zb,r=a.xe,p,u,v;a.valid||x("luf_v_solve: LU-factorization is not valid");for(a=1;a<=d;a++)r[a]=c[a],c[a]=0;if(b)for(a=1;a<=d;a++){if(p=l[a],u=n[a],b=r[u],0!=b)for(c[p]=b/=g[p],v=e[p],p=v+f[p]-1;v<=p;v++)r[m[v]]-=q[v]*b}else for(a=d;1<=a;a--)if(p=l[a],u=n[a],b=r[p],0!=b)for(c[u]=b/=g[p],v=k[u],p=v+h[u]-1;v<=p;v++)r[m[v]]-=q[v]*b}var Wd=401,Xd=402,Yd=403,Zd=404,$d=405,je=412,ke=413,ee=422,fe=423;
function Yg(){return{index:{},W:{},set:{},A:{},K:{},a:{},loop:{}}}function Zg(a){var b;201==a.b?b="_|_":205==a.b?b="'...'":b=a.i;a.context[a.mc++]=" ";60==a.mc&&(a.mc=0);for(var c=0;c<b.length;c++)a.context[a.mc++]=b[c],60==a.mc&&(a.mc=0)}
function $g(a){var b;-1!=a.m&&("\n"==a.m&&(a.gb++,a.Uc=0),b=a.af(),0>b&&(b=-1),a.Uc++,-1==b?"\n"==a.m?a.gb--:ah(a,"final NL missing before end of file"):"\n"!=b&&(0<=" \t\n\v\f\r".indexOf(b)?b=" ":ta(b)&&(Zg(a),U(a,"control character "+b+" not allowed"))),a.m=b)}function ch(a){a.i+=a.m;a.Db++;$g(a)}
function V(a){function b(){Zg(a);U(a,"keyword s.t. incomplete")}function c(){Zg(a);U(a,"cannot convert numeric literal "+a.i+" to floating-point number")}function d(){if("e"==a.m||"E"==a.m)for(ch(a),"+"!=a.m&&"-"!=a.m||ch(a),wa(a.m)||(Zg(a),U(a,"numeric literal "+a.i+" incomplete"));wa(a.m);)ch(a);if(ua(a.m)||"_"==a.m)Zg(a),U(a,"symbol "+a.i+a.m+"... should be enclosed in quotes")}a.Df=a.b;a.Cf=a.Db;a.Bf=a.i;a.Ef=a.value;if(a.Se)a.Se=0,a.b=a.If,a.Db=a.Hf,a.i=a.Gf,a.value=a.Jf;else{for(;;){a.b=0;a.Db=
0;a.i="";for(a.value=0;" "==a.m||"\n"==a.m;)$g(a);if(-1==a.m)a.b=201;else if("#"==a.m){for(;"\n"!=a.m&&-1!=a.m;)$g(a);continue}else if(a.oc||!ua(a.m)&&"_"!=a.m)if(!a.oc&&wa(a.m)){for(a.b=204;wa(a.m);)ch(a);var e=!1;if("."==a.m)if(ch(a),"."==a.m)a.Db--,a.i=a.i.substr(0,a.i.length-1),a.Re=1,e=!0;else for(;wa(a.m);)ch(a);e||d();tg(a.i,function(b){a.value=b})&&c()}else if("'"==a.m||'"'==a.m){var e=function(){for(;;){if("\n"==a.m&&!g||-1==a.m)Zg(a),U(a,"unexpected end of line; string literal incomplete");
if(a.m==f)if($g(a),a.m==f){if(g)if($g(a),a.m==f){$g(a);break}else a.i+='""',a.Db+=2}else if(g)a.i+='"',a.Db++;else break;ch(a)}},f=a.m,g=!1;a.b=205;$g(a);a.m==f?($g(a),a.m==f&&(g=!0,$g(a),e())):e()}else if(a.oc||"+"!=a.m)if(a.oc||"-"!=a.m)if("*"==a.m)a.b=227,ch(a),"*"==a.m&&(a.b=229,ch(a));else if("/"==a.m){if(a.b=228,ch(a),"*"==a.m){for($g(a);;)if(-1==a.m)U(a,"unexpected end of file; comment sequence incomplete");else if("*"==a.m){if($g(a),"/"==a.m)break}else $g(a);$g(a);continue}}else if("^"==a.m)a.b=
229,ch(a);else if("<"==a.m)a.b=230,ch(a),"="==a.m?(a.b=231,ch(a)):">"==a.m?(a.b=235,ch(a)):"-"==a.m&&(a.b=252,ch(a));else if("="==a.m)a.b=232,ch(a),"="==a.m&&ch(a);else if(">"==a.m)a.b=234,ch(a),"="==a.m?(a.b=233,ch(a)):">"==a.m&&(a.b=250,ch(a));else if("!"==a.m)a.b=218,ch(a),"="==a.m&&(a.b=235,ch(a));else if("&"==a.m)a.b=236,ch(a),"&"==a.m&&(a.b=206,ch(a));else if("|"==a.m)a.b=237,ch(a),"|"==a.m&&(a.b=219,ch(a));else if(a.oc||"."!=a.m)if(","==a.m)a.b=239,ch(a);else if(":"==a.m)a.b=240,ch(a),"="==
a.m&&(a.b=242,ch(a));else if(";"==a.m)a.b=241,ch(a);else if("("==a.m)a.b=244,ch(a);else if(")"==a.m)a.b=245,ch(a);else if("["==a.m)a.b=246,ch(a);else if("]"==a.m)a.b=247,ch(a);else if("{"==a.m)a.b=248,ch(a);else if("}"==a.m)a.b=249,ch(a);else if("~"==a.m)a.b=251,ch(a);else if(va(a.m)||0<="+-._".indexOf(a.m)){for(a.b=203;va(a.m)||0<="+-._".indexOf(a.m);)ch(a);switch(tg(a.i,function(b){a.value=b})){case 0:a.b=204;break;case 1:c()}}else Zg(a),U(a,"character "+a.m+" not allowed");else if(a.b=238,ch(a),
a.Re)a.b=243,a.Db=2,a.i="..",a.Re=0;else if("."==a.m)a.b=243,ch(a);else{if(wa(a.m)){a.b=204;for(ch(a);wa(a.m);)ch(a);d();tg(a.i,function(b){a.value=b})&&c()}}else a.b=226,ch(a);else a.b=225,ch(a);else{for(a.b=202;va(a.m)||"_"==a.m;)ch(a);"and"==a.i?a.b=206:"by"==a.i?a.b=207:"cross"==a.i?a.b=208:"diff"==a.i?a.b=209:"div"==a.i?a.b=210:"else"==a.i?a.b=211:"if"==a.i?a.b=212:"in"==a.i?a.b=213:"Infinity"==a.i?a.b=214:"inter"==a.i?a.b=215:"less"==a.i?a.b=216:"mod"==a.i?a.b=217:"not"==a.i?a.b=218:"or"==a.i?
a.b=219:"s"==a.i&&"."==a.m?(a.b=220,ch(a),"t"!=a.m&&b(),ch(a),"."!=a.m&&b(),ch(a)):"symdiff"==a.i?a.b=221:"then"==a.i?a.b=222:"union"==a.i?a.b=223:"within"==a.i&&(a.b=224)}break}Zg(a);a.Lf=0}}function dh(a){a.Se=1;a.If=a.b;a.Hf=a.Db;a.Gf=a.i;a.Jf=a.value;a.b=a.Df;a.Db=a.Cf;a.i=a.Bf;a.value=a.Ef}function eh(a,b){return 202==a.b&&a.i==b}
function fh(a){return 206==a.b&&"a"==a.i[0]||207==a.b||208==a.b||209==a.b||210==a.b||211==a.b||212==a.b||213==a.b||215==a.b||216==a.b||217==a.b||218==a.b&&"n"==a.i[0]||219==a.b&&"o"==a.i[0]||221==a.b||222==a.b||223==a.b||224==a.b}
function gh(a,b,c,d){var e={};e.Wa=a;e.X=0;e.a=Yg();e.value={};switch(a){case 301:e.a.U=b.U;break;case 302:e.a.P=b.P;break;case 303:e.a.index.Ca=b.index.Ca;e.a.index.next=b.index.next;break;case 304:case 305:for(a=b.W.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.W.W=b.W.W;e.a.W.list=b.W.list;break;case 306:for(a=b.set.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.set.set=b.set.set;e.a.set.list=b.set.list;break;case 307:for(a=b.A.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.A.A=b.A.A;e.a.A.list=b.A.list;
e.a.A.Ac=b.A.Ac;break;case 308:for(a=b.K.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.K.K=b.K.K;e.a.K.list=b.K.list;e.a.K.Ac=b.K.Ac;break;case 309:case 310:for(a=b.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.list=b.list;break;case 311:e.a.slice=b.slice;break;case 312:case 313:case 314:case 315:e.X=1;break;case 316:case 317:case 318:case 319:case 320:case 321:case 322:case 323:case 324:case 325:case 326:case 327:case 328:case 329:case 330:case 331:case 332:case 333:case 334:case 335:case 336:case 337:b.a.x.V=
e;e.X|=b.a.x.X;e.a.a.x=b.a.x;break;case 338:case 339:case 340:case 341:case 342:case 343:case 344:case 345:case 346:case 347:case 348:case 349:349==a&&(e.X=1);case 350:350==a&&(e.X=1);case 351:case 352:case 353:case 354:case 355:case 356:case 357:case 358:case 359:case 360:case 361:case 362:case 363:case 364:case 365:case 366:case 367:case 368:case 369:case 370:case 371:b.a.x.V=e;e.X|=b.a.x.X;b.a.y.V=e;e.X|=b.a.y.X;e.a.a.x=b.a.x;e.a.a.y=b.a.y;break;case 372:case 373:case 374:b.a.x.V=e;e.X|=b.a.x.X;
b.a.y.V=e;e.X|=b.a.y.X;null!=b.a.z&&(b.a.z.V=e,e.X|=b.a.z.X);e.a.a.x=b.a.x;e.a.a.y=b.a.y;e.a.a.z=b.a.z;break;case 375:case 376:for(a=b.list;null!=a;a=a.next)a.x.V=e,e.X|=a.x.X;e.a.list=b.list;break;case 377:case 378:case 379:case 380:case 381:case 382:case 383:case 384:a=b.loop.domain;null!=a.code&&(a.code.V=e,e.X|=a.code.X);for(a=a.list;null!=a;a=a.next)a.code.V=e,e.X|=a.code.X;null!=b.loop.x&&(b.loop.x.V=e,e.X|=b.loop.x.X);e.a.loop.domain=b.loop.domain;e.a.loop.x=b.loop.x}e.type=c;e.v=d;e.V=null;
e.valid=0;e.value={};return e}function W(a,b,c,d){var e=Yg();e.a.x=b;return gh(a,e,c,d)}function hh(a,b,c,d,e){var f=Yg();f.a.x=b;f.a.y=c;return gh(a,f,d,e)}function ih(a,b,c,d,e,f){var g=Yg();g.a.x=b;g.a.y=c;g.a.z=d;return gh(a,g,e,f)}function jh(a,b){var c={},d;c.x=b;c.next=null;if(null==a)a=c;else{for(d=a;null!=d.next;d=d.next);d.next=c}return a}function kh(a){var b;for(b=0;null!=a;a=a.next)b++;return b}
function lh(a){var b,c,d,e,f,g,k,h,l,n=Yg(),m=a.$[a.i];null==m&&U(a,a.i+" not defined");switch(m.type){case 111:b=m.link;h=b.name;l=0;break;case 122:c=m.link;h=c.name;l=c.v;0==c.aa&&(c.aa=1);break;case 120:d=m.link;h=d.name;l=d.v;break;case 127:e=m.link;h=e.name;l=e.v;break;case 103:f=m.link,h=f.name,l=f.v}V(a);if(246==a.b){0==l&&U(a,h+" cannot be subscripted");V(a);for(var q=null;;)if(g=mh(a),118==g.type&&(g=W(317,g,124,0)),124!=g.type&&U(a,"subscript expression has invalid type"),q=jh(q,g),239==
a.b)V(a);else if(247==a.b)break;else U(a,"syntax error in subscript list");g=q;l!=kh(g)&&U(a,h+" must have "+l+" subscript"+(1==l?"":"s")+" rather than "+kh(g));V(a)}else 0!=l&&U(a,h+" must be subscripted"),g=null;l=a.Qb||127!=m.type?4:0;238==a.b&&(V(a),202!=a.b&&U(a,"invalid use of period"),127!=m.type&&103!=m.type&&U(a,h+" cannot have a suffix"),"lb"==a.i?l=1:"ub"==a.i?l=2:"status"==a.i?l=3:"val"==a.i?l=4:"dual"==a.i?l=5:U(a,"suffix ."+a.i+" invalid"),V(a));switch(m.type){case 111:n.index.Ca=b;
n.index.next=b.list;k=gh(303,n,124,0);b.list=k;break;case 122:n.set.set=c;n.set.list=g;k=gh(306,n,106,c.aa);break;case 120:n.W.W=d;n.W.list=g;k=124==d.type?gh(305,n,124,0):gh(304,n,118,0);break;case 127:a.Qb||3!=l&&4!=l&&5!=l||U(a,"invalid reference to status, primal value, or dual value of variable "+e.name+" above solve statement");n.A.A=e;n.A.list=g;n.A.Ac=l;k=gh(307,n,0==l?110:118,0);break;case 103:a.Qb||3!=l&&4!=l&&5!=l||U(a,"invalid reference to status, primal value, or dual value of "+(103==
f.type?"constraint":"objective")+" "+f.name+" above solve statement"),n.K.K=f,n.K.list=g,n.K.Ac=l,k=gh(308,n,118,0)}return k}function nh(a,b){var c=mh(a);124==c.type&&(c=W(316,c,118,0));118!=c.type&&U(a,"argument for "+b+" has invalid type");return c}function oh(a,b){var c=mh(a);118==c.type&&(c=W(317,c,124,0));124!=c.type&&U(a,"argument for "+b+" has invalid type");return c}
function ph(a,b,c){var d={};d.name=b;d.code=c;d.value=null;d.list=null;d.next=null;if(null==a.list)a.list=d;else{for(a=a.list;null!=a.next;a=a.next);a.next=d}}
function qh(a){var b,c=Yg(),d=Array(21);ka(d,0,21);var e,f,g,k=0;e=a.Lf;V(a);for(g=1;;g++){var h=function(){b=rh(a);if(239==a.b||1<g)118==b.type&&(b=W(317,b,124,0)),124!=b.type&&U(a,"component expression has invalid type");d[g].name=null;d[g].code=b};20<g&&U(a,"too many components within parentheses");if(202==a.b)if(V(a),f=a.b,dh(a),!e||239!=f&&245!=f||null!=a.$[a.i])h();else{for(f=1;f<g;f++)null!=d[f].name&&d[f].name==a.i&&U(a,"duplicate dummy index "+a.i+" not allowed");d[g].name=a.i;d[g].code=
null;V(a);k=1;1==g&&245==a.b&&U(a,d[g].name+" not defined")}else h();if(239==a.b)V(a);else if(245==a.b)break;else U(a,"right parenthesis missing where expected")}if(1!=g||k)if(k){c.slice={};for(f=1;f<=g;f++)ph(c.slice,d[f].name,d[f].code);b=gh(311,c,126,g)}else{c.list=null;for(f=1;f<=g;f++)c.list=jh(c.list,d[f].code);b=gh(309,c,126,g)}else b=d[1].code;V(a);k&&213!=a.b&&U(a,"keyword in missing where expected");e&&213==a.b&&!k&&(1==g?U(a,"syntax error in indexing expression"):U(a,"0-ary slice not allowed"));
return b}
function sh(a){var b,c,d,e;V(a);249==a.b&&U(a,"empty indexing expression not allowed");for(b={};;){e=c=null;202==a.b?(V(a),d=a.b,dh(a),213==d&&null==a.$[a.i]&&(c={},d=a.i,ph(c,d,null),V(a),V(a))):244==a.b&&(a.Lf=1,e=th(a),311==e.Wa&&(c=e.a.slice,e=null,V(a)));null==e&&(e=th(a));if(106!=e.type){null!=c&&U(a,"domain expression has invalid type");d=a;var f=Yg(),g=void 0;f.list=null;for(g=1;;g++){118==e.type&&(e=W(317,e,124,0));124==e.type&&(e=W(319,e,126,1));126!=e.type&&U(d,"member expression has invalid type");null!=
f.list&&f.list.x.v!=e.v&&U(d,"member "+(g-1)+" has "+f.list.x.v+" component"+(1==f.list.x.v?"":"s")+" while member "+g+" has "+e.v+" component"+(1==e.v?"":"s"));f.list=jh(f.list,e);if(239==d.b)V(d);else if(249==d.b)break;else U(d,"syntax error in literal set");e=mh(d)}e=gh(310,f,106,f.list.x.v)}if(null==c)for(c={},d=1;d<=e.v;d++)ph(c,null,null);f=0;for(d=c.list;null!=d;d=d.next)f++;f!=e.v&&U(a,f+" "+(1==f?"index":"indices")+" specified for set of dimension "+e.v);c.code=e;e=b;d=c;f=void 0;if(null==
e.list)e.list=d;else{for(f=e.list;null!=f.next;f=f.next);f.next=d}for(d=c.list;null!=d;d=d.next)null!=d.name&&(a.$[d.name]={type:111,link:d});if(239==a.b)V(a);else if(240==a.b||249==a.b)break;else U(a,"syntax error in indexing expression")}240==a.b&&(V(a),e=rh(a),124==e.type&&(e=W(316,e,118,0)),118==e.type&&(e=W(318,e,114,0)),114!=e.type&&U(a,"expression following colon has invalid type"),b.code=e,249!=a.b&&U(a,"syntax error in indexing expression"));V(a);return b}
function uh(a,b){var c,d;for(c=b.list;null!=c;c=c.next)for(d=c.list;null!=d;d=d.next)null!=d.name&&delete a.$[d.name]}function vh(a){var b,c;for(b=a.a.loop.domain.list;null!=b;b=b.next)for(c=b.list;null!=c;c=c.next)null!=c.code&&(c.code.V=a)}
function wh(a){function b(){U(a,"integrand following "+f+"{...} has invalid type")}var c,d=Yg(),e,f;"sum"==a.i?e=377:"prod"==a.i?e=378:"min"==a.i?e=379:"max"==a.i?e=380:"forall"==a.i?e=381:"exists"==a.i?e=382:"setof"==a.i?e=383:U(a,"operator "+a.i+" unknown");f=a.i;V(a);d.loop.domain=sh(a);switch(e){case 377:case 378:case 379:case 380:d.loop.x=xh(a);124==d.loop.x.type&&(d.loop.x=W(316,d.loop.x,118,0));118==d.loop.x.type||377==e&&110==d.loop.x.type||b();c=gh(e,d,d.loop.x.type,0);break;case 381:case 382:d.loop.x=
yh(a);124==d.loop.x.type&&(d.loop.x=W(316,d.loop.x,118,0));118==d.loop.x.type&&(d.loop.x=W(318,d.loop.x,114,0));114!=d.loop.x.type&&b();c=gh(e,d,114,0);break;case 383:d.loop.x=mh(a),118==d.loop.x.type&&(d.loop.x=W(317,d.loop.x,124,0)),124==d.loop.x.type&&(d.loop.x=W(319,d.loop.x,126,1)),126!=d.loop.x.type&&b(),c=gh(e,d,106,d.loop.x.v)}uh(a,d.loop.domain);vh(c);return c}function zh(a){var b=0;for(a=a.list;null!=a;a=a.next)for(var c=a.list;null!=c;c=c.next)null==c.code&&b++;return b}
function Ah(a,b){U(a,"operand preceding "+b+" has invalid type")}function Bh(a,b){U(a,"operand following "+b+" has invalid type")}function Ch(a,b,c,d){U(a,"operands preceding and following "+b+" have different dimensions "+c+" and "+d+", respectively")}
function Dh(a){var b,c;if(204==a.b)b=Yg(),b.U=a.value,b=gh(301,b,118,0),V(a),c=b;else if(214==a.b)b=Yg(),b.U=t,c=gh(301,b,118,0),V(a);else if(205==a.b)b=Yg(),b.P=a.i,b=gh(302,b,124,0),V(a),c=b;else if(202==a.b)switch(V(a),c=a.b,dh(a),c){case 246:c=lh(a);break;case 244:c=Yg();var d;"abs"==a.i?b=324:"ceil"==a.i?b=325:"floor"==a.i?b=326:"exp"==a.i?b=327:"log"==a.i?b=328:"log10"==a.i?b=329:"sqrt"==a.i?b=330:"sin"==a.i?b=331:"cos"==a.i?b=332:"atan"==a.i?b=333:"min"==a.i?b=375:"max"==a.i?b=376:"round"==
a.i?b=334:"trunc"==a.i?b=335:"Irand224"==a.i?b=312:"Uniform01"==a.i?b=313:"Uniform"==a.i?b=349:"Normal01"==a.i?b=314:"Normal"==a.i?b=350:"card"==a.i?b=336:"length"==a.i?b=337:"substr"==a.i?b=369:"str2time"==a.i?b=370:"time2str"==a.i?b=371:"gmtime"==a.i?b=315:U(a,"function "+a.i+" unknown");d=a.i;V(a);V(a);if(375==b||376==b)for(c.list=null;;)if(c.list=jh(c.list,nh(a,d)),239==a.b)V(a);else if(245==a.b)break;else U(a,"syntax error in argument list for "+d);else if(312==b||313==b||314==b||315==b)245!=
a.b&&U(a,d+" needs no arguments");else if(349==b||350==b)c.a.x=nh(a,d),239!=a.b&&(245==a.b?U(a,d+" needs two arguments"):U(a,"syntax error in argument for "+d)),V(a),c.a.y=nh(a,d),239==a.b?U(a,d+" needs two argument"):245!=a.b&&U(a,"syntax error in argument for "+d);else if(333==b||334==b||335==b){c.a.x=nh(a,d);if(239==a.b){switch(b){case 333:b=346;break;case 334:b=347;break;case 335:b=348}V(a);c.a.y=nh(a,d)}239==a.b?U(a,d+" needs one or two arguments"):245!=a.b&&U(a,"syntax error in argument for "+
d)}else if(369==b)c.a.x=oh(a,d),239!=a.b&&(245==a.b?U(a,d+" needs two or three arguments"):U(a,"syntax error in argument for "+d)),V(a),c.a.y=nh(a,d),239==a.b&&(b=374,V(a),c.a.z=nh(a,d)),239==a.b?U(a,d+" needs two or three arguments"):245!=a.b&&U(a,"syntax error in argument for "+d);else if(370==b)c.a.x=oh(a,d),239!=a.b&&(245==a.b?U(a,d+" needs two arguments"):U(a,"syntax error in argument for "+d)),V(a),c.a.y=oh(a,d),239==a.b?U(a,d+" needs two argument"):245!=a.b&&U(a,"syntax error in argument for "+
d);else if(371==b)c.a.x=nh(a,d),239!=a.b&&(245==a.b?U(a,d+" needs two arguments"):U(a,"syntax error in argument for "+d)),V(a),c.a.y=oh(a,d),239==a.b?U(a,d+" needs two argument"):245!=a.b&&U(a,"syntax error in argument for "+d);else{var e=c.a,f;336==b?(f=th(a),106!=f.type&&U(a,"argument for "+d+" has invalid type")):f=337==b?oh(a,d):nh(a,d);e.x=f;239==a.b?U(a,d+" needs one argument"):245!=a.b&&U(a,"syntax error in argument for "+d)}b=369==b||374==b||371==b?gh(b,c,124,0):gh(b,c,118,0);V(a);c=b;break;
case 248:c=wh(a);break;default:c=lh(a)}else if(244==a.b)c=qh(a);else if(248==a.b)b=Yg(),V(a),249==a.b?(b.list=null,b=gh(310,b,106,1),V(a)):(dh(a),b.loop.domain=sh(a),b.loop.x=null,uh(a,b.loop.domain),b=gh(384,b,106,zh(b.loop.domain)),vh(b)),c=b;else if(212==a.b){V(a);b=rh(a);124==b.type&&(b=W(316,b,118,0));118==b.type&&(b=W(318,b,114,0));114!=b.type&&U(a,"expression following if has invalid type");222!=a.b&&U(a,"keyword then missing where expected");V(a);c=th(a);118!=c.type&&124!=c.type&&106!=c.type&&
110!=c.type&&U(a,"expression following then has invalid type");if(211!=a.b)106==c.type&&U(a,"keyword else missing where expected"),d=null;else{V(a);d=th(a);118!=d.type&&124!=d.type&&106!=d.type&&110!=d.type&&U(a,"expression following else has invalid type");if(110==c.type||110==d.type)124==c.type&&(c=W(316,c,118,0)),118==c.type&&(c=W(320,c,110,0)),124==d.type&&(d=W(316,d,118,0)),118==d.type&&(d=W(320,d,110,0));if(124==c.type||124==d.type)118==c.type&&(c=W(317,c,124,0)),118==d.type&&(d=W(317,d,124,
0));c.type!=d.type&&U(a,"expressions following then and else have incompatible types");c.v!=d.v&&U(a,"expressions following then and else have different dimensions "+c.v+" and "+d.v+", respectively")}c=ih(373,b,c,d,c.type,c.v)}else fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"syntax error in expression");229==a.b&&(d=a.i,124==c.type&&(c=W(316,c,118,0)),118!=c.type&&Ah(a,d),V(a),b=225==a.b||226==a.b?Eh(a):Dh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,d),c=hh(345,c,b,118,0));return c}
function Eh(a){var b;225==a.b?(V(a),b=Dh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&110!=b.type&&Bh(a,"+"),b=W(321,b,b.type,0)):226==a.b?(V(a),b=Dh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&110!=b.type&&Bh(a,"-"),b=W(322,b,b.type,0)):b=Dh(a);return b}
function xh(a){for(var b,c=Eh(a);;)if(227==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&110!=c.type&&Ah(a,"*"),V(a),b=Eh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&110!=b.type&&Bh(a,"*"),110==c.type&&110==b.type&&U(a,"multiplication of linear forms not allowed"),c=118==c.type&&118==b.type?hh(341,c,b,118,0):hh(341,c,b,110,0);else if(228==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&110!=c.type&&Ah(a,"/"),V(a),b=Eh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,"/"),c=118==c.type?
hh(342,c,b,118,0):hh(342,c,b,110,0);else if(210==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&Ah(a,"div"),V(a),b=Eh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,"div"),c=hh(343,c,b,118,0);else if(217==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&Ah(a,"mod"),V(a),b=Eh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,"mod"),c=hh(344,c,b,118,0);else break;return c}
function Fh(a){for(var b,c=xh(a);;)if(225==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&110!=c.type&&Ah(a,"+"),V(a),b=xh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&110!=b.type&&Bh(a,"+"),118==c.type&&110==b.type&&(c=W(320,c,110,0)),110==c.type&&118==b.type&&(b=W(320,b,110,0)),c=hh(338,c,b,c.type,0);else if(226==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&110!=c.type&&Ah(a,"-"),V(a),b=xh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&110!=b.type&&Bh(a,"-"),118==c.type&&110==b.type&&
(c=W(320,c,110,0)),110==c.type&&118==b.type&&(b=W(320,b,110,0)),c=hh(339,c,b,c.type,0);else if(216==a.b)124==c.type&&(c=W(316,c,118,0)),118!=c.type&&Ah(a,"less"),V(a),b=xh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,"less"),c=hh(340,c,b,118,0);else break;return c}function mh(a){for(var b,c=Fh(a);;)if(236==a.b)118==c.type&&(c=W(317,c,124,0)),124!=c.type&&Ah(a,"&"),V(a),b=Fh(a),118==b.type&&(b=W(317,b,124,0)),124!=b.type&&Bh(a,"&"),c=hh(351,c,b,124,0);else break;return c}
function Gh(a){var b,c,d=mh(a);243==a.b&&(124==d.type&&(d=W(316,d,118,0)),118!=d.type&&Ah(a,".."),V(a),b=mh(a),124==b.type&&(b=W(316,b,118,0)),118!=b.type&&Bh(a,".."),207==a.b?(V(a),c=mh(a),124==c.type&&(c=W(316,c,118,0)),118!=c.type&&Bh(a,"by")):c=null,d=ih(372,d,b,c,106,1));return d}function Hh(a){for(var b,c=Gh(a);;)if(208==a.b)106!=c.type&&Ah(a,"cross"),V(a),b=Gh(a),106!=b.type&&Bh(a,"cross"),c=hh(364,c,b,106,c.v+b.v);else break;return c}
function Ih(a){for(var b,c=Hh(a);;)if(215==a.b)106!=c.type&&Ah(a,"inter"),V(a),b=Hh(a),106!=b.type&&Bh(a,"inter"),c.v!=b.v&&Ch(a,"inter",c.v,b.v),c=hh(363,c,b,106,c.v);else break;return c}
function th(a){for(var b,c=Ih(a);;)if(223==a.b)106!=c.type&&Ah(a,"union"),V(a),b=Ih(a),106!=b.type&&Bh(a,"union"),c.v!=b.v&&Ch(a,"union",c.v,b.v),c=hh(360,c,b,106,c.v);else if(209==a.b)106!=c.type&&Ah(a,"diff"),V(a),b=Ih(a),106!=b.type&&Bh(a,"diff"),c.v!=b.v&&Ch(a,"diff",c.v,b.v),c=hh(361,c,b,106,c.v);else if(221==a.b)106!=c.type&&Ah(a,"symdiff"),V(a),b=Ih(a),106!=b.type&&Bh(a,"symdiff"),c.v!=b.v&&Ch(a,"symdiff",c.v,b.v),c=hh(362,c,b,106,c.v);else break;return c}
function Jh(a){var b,c=-1,d="",e=th(a);switch(a.b){case 230:c=352;break;case 231:c=353;break;case 232:c=354;break;case 233:c=355;break;case 234:c=356;break;case 235:c=357;break;case 213:c=365;break;case 224:c=367;break;case 218:d=a.i;V(a);213==a.b?c=366:224==a.b?c=368:U(a,"invalid use of "+d);d+=" ";break;default:return e}d+=a.i;switch(c){case 354:case 357:case 352:case 353:case 356:case 355:118!=e.type&&124!=e.type&&Ah(a,d);V(a);b=th(a);118!=b.type&&124!=b.type&&Bh(a,d);118==e.type&&124==b.type&&
(e=W(317,e,124,0));124==e.type&&118==b.type&&(b=W(317,b,124,0));e=hh(c,e,b,114,0);break;case 365:case 366:118==e.type&&(e=W(317,e,124,0));124==e.type&&(e=W(319,e,126,1));126!=e.type&&Ah(a,d);V(a);b=th(a);106!=b.type&&Bh(a,d);e.v!=b.v&&Ch(a,d,e.v,b.v);e=hh(c,e,b,114,0);break;case 367:case 368:106!=e.type&&Ah(a,d),V(a),b=th(a),106!=b.type&&Bh(a,d),e.v!=b.v&&Ch(a,d,e.v,b.v),e=hh(c,e,b,114,0)}return e}
function Kh(a){var b,c;218==a.b?(c=a.i,V(a),b=Jh(a),124==b.type&&(b=W(316,b,118,0)),118==b.type&&(b=W(318,b,114,0)),114!=b.type&&Bh(a,c),b=W(323,b,114,0)):b=Jh(a);return b}function yh(a){for(var b,c="",d=Kh(a);;)if(206==a.b)c=a.i,124==d.type&&(d=W(316,d,118,0)),118==d.type&&(d=W(318,d,114,0)),114!=d.type&&Ah(a,c),V(a),b=Kh(a),124==b.type&&(b=W(316,b,118,0)),118==b.type&&(b=W(318,b,114,0)),114!=b.type&&Bh(a,c),d=hh(358,d,b,114,0);else break;return d}
function rh(a){for(var b,c=yh(a);;)if(219==a.b){var d=a.i;124==c.type&&(c=W(316,c,118,0));118==c.type&&(c=W(318,c,114,0));114!=c.type&&Ah(a,d);V(a);b=yh(a);124==b.type&&(b=W(316,b,118,0));118==b.type&&(b=W(318,b,114,0));114!=b.type&&Bh(a,d);c=hh(359,c,b,114,0)}else break;return c}
function Lh(a){function b(){U(a,"at most one := or default/data allowed")}function c(){U(a,a.i+" not a plain set")}function d(){U(a,"dimension of "+a.i+" too small")}function e(){U(a,"component number must be integer between 1 and "+h.set.aa)}var f,g,k=0,h;V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));null!=a.$[a.i]&&U(a,a.i+" multiply declared");f={};f.name=a.i;f.Kb=null;f.v=0;f.domain=null;f.aa=0;f.xf=null;f.assign=null;f.Ba=null;
f.Xc=null;f.data=0;f.T=null;V(a);205==a.b&&(f.Kb=a.i,V(a));248==a.b&&(f.domain=sh(a),f.v=zh(f.domain));g=a.$[f.name]={};g.type=122;for(g.link=f;;){if(239==a.b)V(a);else if(241==a.b)break;if(eh(a,"dimen")){var l;V(a);204==a.b&&1<=a.value&&20>=a.value&&Math.floor(a.value)==a.value||U(a,"dimension must be integer between 1 and 20");l=a.value+.5|0;k&&U(a,"at most one dimension attribute allowed");0<f.aa&&U(a,"dimension "+l+" conflicts with dimension "+f.aa+" already determined");f.aa=l;k=1;V(a)}else if(224==
a.b||213==a.b){213!=a.b||a.ng||(ah(a,"keyword in understood as within"),a.ng=1);V(a);l={code:null,next:null};if(null==f.xf)f.xf=l;else{for(g=f.xf;null!=g.next;g=g.next);g.next=l}l.code=th(a);106!=l.code.type&&U(a,"expression following within has invalid type");0==f.aa&&(f.aa=l.code.v);f.aa!=l.code.v&&U(a,"set expression following within must have dimension "+f.aa+" rather than "+l.code.v)}else if(242==a.b)null==f.assign&&null==f.Ba&&null==f.Xc||b(),V(a),f.assign=th(a),106!=f.assign.type&&U(a,"expression following := has invalid type"),
0==f.aa&&(f.aa=f.assign.v),f.aa!=f.assign.v&&U(a,"set expression following := must have dimension "+f.aa+" rather than "+f.assign.v);else if(eh(a,"default"))null==f.assign&&null==f.Ba||b(),V(a),f.Ba=th(a),106!=f.Ba.type&&U(a,"expression following default has invalid type"),0==f.aa&&(f.aa=f.Ba.v),f.aa!=f.Ba.v&&U(a,"set expression following default must have dimension "+f.aa+" rather than "+f.Ba.v);else if(eh(a,"data")){var n=0;l=Array(20);null==f.assign&&null==f.Xc||b();V(a);f.Xc=h={};202!=a.b&&(fh(a)?
U(a,"invalid use of reserved keyword "+a.i):U(a,"set name missing where expected"));g=a.$[a.i];null==g&&U(a,a.i+" not defined");122!=g.type&&c();h.set=g.link;0!=h.set.v&&c();h.set==f&&U(a,"set cannot be initialized by itself");f.v>=h.set.aa&&d();0==f.aa&&(f.aa=h.set.aa-f.v);f.v+f.aa>h.set.aa?d():f.v+f.aa<h.set.aa&&U(a,"dimension of "+a.i+" too big");V(a);244==a.b?V(a):U(a,"left parenthesis missing where expected");for(g=0;g<h.set.aa;g++)l[g]=0;for(g=0;;)if(204!=a.b&&U(a,"component number missing where expected"),
0!=ug(a.i,function(a){n=a})&&e(),1<=n&&n<=h.set.aa||e(),0!=l[n-1]&&U(a,"component "+n+" multiply specified"),h.ca[g++]=n,l[n-1]=1,V(a),239==a.b)V(a);else if(245==a.b)break;else U(a,"syntax error in data attribute");g<h.set.aa&&U(a,"there are must be "+h.set.aa+" components rather than "+g);V(a)}else U(a,"syntax error in set statement")}null!=f.domain&&uh(a,f.domain);0==f.aa&&(f.aa=1);V(a);return f}
function Mh(a){function b(){g&&U(a,"at most one binary allowed");124==d.type&&U(a,"symbolic parameter cannot be binary");d.type=101;g=1;V(a)}function c(){U(a,"at most one := or default allowed")}var d,e,f=0,g=0,k=0;V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));null!=a.$[a.i]&&U(a,a.i+" multiply declared");d={};d.name=a.i;d.Kb=null;d.v=0;d.domain=null;d.type=118;d.ud=null;d.ua=null;d.assign=null;d.Ba=null;d.data=0;d.Vc=null;d.T=null;
V(a);205==a.b&&(d.Kb=a.i,V(a));248==a.b&&(d.domain=sh(a),d.v=zh(d.domain));e=a.$[d.name]={};e.type=120;for(e.link=d;;){if(239==a.b)V(a);else if(241==a.b)break;if(eh(a,"integer"))f&&U(a,"at most one integer allowed"),124==d.type&&U(a,"symbolic parameter cannot be integer"),101!=d.type&&(d.type=113),f=1,V(a);else if(eh(a,"binary"))b();else if(eh(a,"logical"))a.Ie||(ah(a,"keyword logical understood as binary"),a.Ie=1),b();else if(eh(a,"symbolic"))k&&U(a,"at most one symbolic allowed"),118!=d.type&&U(a,
"integer or binary parameter cannot be symbolic"),null==d.ud&&null==d.ua&&null==d.assign&&null==d.Ba||U(a,"keyword symbolic must precede any other parameter attributes"),d.type=124,k=1,V(a);else if(230==a.b||231==a.b||232==a.b||233==a.b||234==a.b||235==a.b){var h,l={};switch(a.b){case 230:l.hd=352;h=a.i;break;case 231:l.hd=353;h=a.i;break;case 232:l.hd=354;h=a.i;break;case 233:l.hd=355;h=a.i;break;case 234:l.hd=356;h=a.i;break;case 235:l.hd=357,h=a.i}l.code=null;l.next=null;if(null==d.ud)d.ud=l;else{for(e=
d.ud;null!=e.next;e=e.next);e.next=l}V(a);l.code=mh(a);118!=l.code.type&&124!=l.code.type&&U(a,"expression following "+h+" has invalid type");124!=d.type&&124==l.code.type&&(l.code=W(316,l.code,118,0));124==d.type&&124!=l.code.type&&(l.code=W(317,l.code,124,0))}else if(213==a.b||224==a.b){224!=a.b||a.mg||(ah(a,"keyword within understood as in"),a.mg=1);V(a);l={code:null,next:null};if(null==d.ua)d.ua=l;else{for(e=d.ua;null!=e.next;e=e.next);e.next=l}l.code=th(a);106!=l.code.type&&U(a,"expression following in has invalid type");
1!=l.code.v&&U(a,"set expression following in must have dimension 1 rather than "+l.code.v)}else 242==a.b?(null==d.assign&&null==d.Ba||c(),V(a),d.assign=mh(a),118!=d.assign.type&&124!=d.assign.type&&U(a,"expression following := has invalid type"),124!=d.type&&124==d.assign.type&&(d.assign=W(316,d.assign,118,0)),124==d.type&&124!=d.assign.type&&(d.assign=W(317,d.assign,124,0))):eh(a,"default")?(null==d.assign&&null==d.Ba||c(),V(a),d.Ba=mh(a),118!=d.Ba.type&&124!=d.Ba.type&&U(a,"expression following default has invalid type"),
124!=d.type&&124==d.Ba.type&&(d.Ba=W(316,d.Ba,118,0)),124==d.type&&124!=d.Ba.type&&(d.Ba=W(317,d.Ba,124,0))):U(a,"syntax error in parameter statement")}null!=d.domain&&uh(a,d.domain);V(a);return d}
function Nh(a){function b(){d&&U(a,"at most one binary allowed");e.type=101;d=1;V(a)}var c=0,d=0;a.Qb&&U(a,"variable statement must precede solve statement");V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));null!=a.$[a.i]&&U(a,a.i+" multiply declared");var e={};e.name=a.i;e.Kb=null;e.v=0;e.domain=null;e.type=118;e.S=null;e.Z=null;e.T=null;V(a);205==a.b&&(e.Kb=a.i,V(a));248==a.b&&(e.domain=sh(a),e.v=zh(e.domain));var f=a.$[e.name]={};f.type=
127;for(f.link=e;;){if(239==a.b)V(a);else if(241==a.b)break;if(eh(a,"integer"))c&&U(a,"at most one integer allowed"),101!=e.type&&(e.type=113),c=1,V(a);else if(eh(a,"binary"))b();else if(eh(a,"logical"))a.Ie||(ah(a,"keyword logical understood as binary"),a.Ie=1),b();else if(eh(a,"symbolic"))U(a,"variable cannot be symbolic");else if(233==a.b)null!=e.S&&(e.S==e.Z?U(a,"both fixed value and lower bound not allowed"):U(a,"at most one lower bound allowed")),V(a),e.S=mh(a),124==e.S.type&&(e.S=W(316,e.S,
118,0)),118!=e.S.type&&U(a,"expression following >= has invalid type");else if(231==a.b)null!=e.Z&&(e.Z==e.S?U(a,"both fixed value and upper bound not allowed"):U(a,"at most one upper bound allowed")),V(a),e.Z=mh(a),124==e.Z.type&&(e.Z=W(316,e.Z,118,0)),118!=e.Z.type&&U(a,"expression following <= has invalid type");else if(232==a.b){if(null!=e.S||null!=e.Z)e.S==e.Z?U(a,"at most one fixed value allowed"):null!=e.S?U(a,"both lower bound and fixed value not allowed"):U(a,"both upper bound and fixed value not allowed");
f=a.i;V(a);e.S=mh(a);124==e.S.type&&(e.S=W(316,e.S,118,0));118!=e.S.type&&U(a,"expression following "+f+" has invalid type");e.Z=e.S}else 230==a.b||234==a.b||235==a.b?U(a,"strict bound not allowed"):U(a,"syntax error in variable statement")}null!=e.domain&&uh(a,e.domain);V(a);return e}
function Oh(a){function b(){U(a,"syntax error in constraint statement")}var c,d,e,f;a.Qb&&U(a,"constraint statement must precede solve statement");eh(a,"subject")?(V(a),eh(a,"to")||U(a,"keyword subject to incomplete"),V(a)):eh(a,"subj")?(V(a),eh(a,"to")||U(a,"keyword subj to incomplete"),V(a)):220==a.b&&V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));null!=a.$[a.i]&&U(a,a.i+" multiply declared");var g={};g.name=a.i;g.Kb=null;g.v=0;g.domain=
null;g.type=103;g.code=null;g.S=null;g.Z=null;g.T=null;V(a);205==a.b&&(g.Kb=a.i,V(a));248==a.b&&(g.domain=sh(a),g.v=zh(g.domain));c=a.$[g.name]={};c.type=103;c.link=g;240!=a.b&&U(a,"colon missing where expected");V(a);c=mh(a);124==c.type&&(c=W(316,c,118,0));118!=c.type&&110!=c.type&&U(a,"expression following colon has invalid type");239==a.b&&V(a);switch(a.b){case 231:case 233:case 232:break;case 230:case 234:case 235:U(a,"strict inequality not allowed");break;case 241:U(a,"constraint must be equality or inequality");
break;default:b()}f=a.b;e=a.i;V(a);d=mh(a);124==d.type&&(d=W(316,d,118,0));118!=d.type&&110!=d.type&&U(a,"expression following "+e+" has invalid type");239==a.b&&(V(a),241==a.b&&b());230==a.b||231==a.b||232==a.b||233==a.b||234==a.b||235==a.b?(232!=f&&a.b==f||U(a,"double inequality must be ... <= ... <= ... or ... >= ... >= ..."),110==c.type&&U(a,"leftmost expression in double inequality cannot be linear form"),V(a),e=mh(a),124==e.type&&(e=W(316,d,118,0)),118!=e.type&&110!=e.type&&U(a,"rightmost expression in double inequality constraint has invalid type"),
110==e.type&&U(a,"rightmost expression in double inequality cannot be linear form")):e=null;null!=g.domain&&uh(a,g.domain);110!=c.type&&(c=W(320,c,110,0));110!=d.type&&(d=W(320,d,110,0));null!=e&&(e=W(320,e,110,0));if(null==e)switch(f){case 231:g.code=c;g.S=null;g.Z=d;break;case 233:g.code=c;g.S=d;g.Z=null;break;case 232:g.code=c,g.S=d,g.Z=d}else switch(f){case 231:g.code=d;g.S=c;g.Z=e;break;case 233:g.code=d,g.S=e,g.Z=c}241!=a.b&&b();V(a);return g}
function Ph(a){!a.oc&&eh(a,"end")||a.oc&&Qh(a,"end")?(V(a),241==a.b?V(a):ah(a,"no semicolon following end statement; missing semicolon inserted")):ah(a,"unexpected end of file; missing end statement inserted");201!=a.b&&ah(a,"some text detected beyond end statement; text ignored")}
function Rh(a,b){var c={C:{}};c.gb=a.gb;c.Uc=a.Uc;c.next=null;if(eh(a,"set"))b&&U(a,"set statement not allowed here"),c.type=122,c.C.set=Lh(a);else if(eh(a,"param"))b&&U(a,"parameter statement not allowed here"),c.type=120,c.C.W=Mh(a);else if(eh(a,"var"))b&&U(a,"variable statement not allowed here"),c.type=127,c.C.A=Nh(a);else if(eh(a,"subject")||eh(a,"subj")||220==a.b)b&&U(a,"constraint statement not allowed here"),c.type=103,c.C.K=Oh(a);else if(eh(a,"minimize")||eh(a,"maximize")){b&&U(a,"objective statement not allowed here");
c.type=103;var d=c.C,e,f;eh(a,"minimize")?f=116:eh(a,"maximize")&&(f=115);a.Qb&&U(a,"objective statement must precede solve statement");V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));null!=a.$[a.i]&&U(a,a.i+" multiply declared");e={};e.name=a.i;e.Kb=null;e.v=0;e.domain=null;e.type=f;e.code=null;e.S=null;e.Z=null;e.T=null;V(a);205==a.b&&(e.Kb=a.i,V(a));248==a.b&&(e.domain=sh(a),e.v=zh(e.domain));var g=a.$[e.name]={};g.type=103;g.link=
e;240!=a.b&&U(a,"colon missing where expected");V(a);e.code=mh(a);124==e.code.type&&(e.code=W(316,e.code,118,0));118==e.code.type&&(e.code=W(320,e.code,110,0));110!=e.code.type&&U(a,"expression following colon has invalid type");null!=e.domain&&uh(a,e.domain);241!=a.b&&U(a,"syntax error in objective statement");V(a);d.K=e}else if(eh(a,"table")){b&&U(a,"table statement not allowed here");c.type=125;var d=c.C,k,h;V(a);202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"symbolic name missing where expected"));
null!=a.$[a.i]&&U(a,a.i+" multiply declared");e={C:{ua:{},Nc:{}}};e.name=a.i;V(a);205==a.b?(e.Kb=a.i,V(a)):e.Kb=null;248==a.b?(e.type=119,e.C.Nc.domain=sh(a),eh(a,"OUT")||U(a,"keyword OUT missing where expected")):(e.type=112,eh(a,"IN")||U(a,"keyword IN missing where expected"));V(a);for(e.a=f=null;;)if(k={},239!=a.b&&240!=a.b&&241!=a.b||U(a,"argument expression missing where expected"),k.code=mh(a),118==k.code.type&&(k.code=W(317,k.code,124,0)),124!=k.code.type&&U(a,"argument expression has invalid type"),
k.next=null,null==f?e.a=k:f.next=k,f=k,239==a.b)V(a);else if(240==a.b||241==a.b)break;240==a.b?V(a):U(a,"colon missing where expected");switch(e.type){case 112:202==a.b?(g=a.$[a.i],null==g&&U(a,a.i+" not defined"),122!=g.type&&U(a,a.i+" not a set"),e.C.ua.set=g.link,null!=e.C.ua.set.assign&&U(a,a.i+" needs no data"),0!=e.C.ua.set.v&&U(a,a.i+" must be a simple set"),V(a),252==a.b?V(a):U(a,"delimiter <- missing where expected")):fh(a)?U(a,"invalid use of reserved keyword "+a.i):e.C.ua.set=null;e.C.ua.Ue=
g=null;f=0;for(246==a.b?V(a):U(a,"field list missing where expected");;)if(k={},202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"field name missing where expected")),k.name=a.i,V(a),k.next=null,null==g?e.C.ua.Ue=k:g.next=k,g=k,f++,239==a.b)V(a);else if(247==a.b)break;else U(a,"syntax error in field list");null!=e.C.ua.set&&e.C.ua.set.aa!=f&&U(a,"there must be "+e.C.ua.set.aa+" field"+(1==e.C.ua.set.aa?"":"s")+" rather than "+f);V(a);for(e.C.ua.list=k=null;239==a.b;)V(a),h={},202!=
a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"parameter name missing where expected")),g=a.$[a.i],null==g&&U(a,a.i+" not defined"),120!=g.type&&U(a,a.i+" not a parameter"),h.W=g.link,h.W.v!=f&&U(a,a.i+" must have "+f+" subscript"+(1==f?"":"s")+" rather than "+h.W.v),null!=h.W.assign&&U(a,a.i+" needs no data"),V(a),251==a.b?(V(a),202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"field name missing where expected")),g=a.i,V(a)):g=h.W.name,h.name=g,h.next=null,null==k?
e.C.ua.list=h:k.next=h,k=h;break;case 119:for(e.C.Nc.list=f=null;;)if(k={},239!=a.b&&241!=a.b||U(a,"expression missing where expected"),202==a.b?g=a.i:g="",k.code=mh(a),251==a.b&&(V(a),202!=a.b&&(fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"field name missing where expected")),g=a.i,V(a)),""==g&&U(a,"field name required"),k.name=g,k.next=null,null==f?e.C.Nc.list=k:f.next=k,f=k,239==a.b)V(a);else if(241==a.b)break;else U(a,"syntax error in output list");uh(a,e.C.Nc.domain)}241!=a.b&&U(a,
"syntax error in table statement");V(a);d.tab=e}else if(eh(a,"solve"))b&&U(a,"solve statement not allowed here"),c.type=123,d=c.C,a.Qb&&U(a,"at most one solve statement allowed"),a.Qb=1,V(a),241!=a.b&&U(a,"syntax error in solve statement"),V(a),d.uh=null;else if(eh(a,"check"))c.type=102,d=c.C,e={domain:null,code:null},V(a),248==a.b&&(e.domain=sh(a)),240==a.b&&V(a),e.code=rh(a),114!=e.code.type&&U(a,"expression has invalid type"),null!=e.domain&&uh(a,e.domain),241!=a.b&&U(a,"syntax error in check statement"),
V(a),d.Mg=e;else if(eh(a,"display")){c.type=104;d=c.C;g={domain:null};g.list=e=null;V(a);248==a.b&&(g.domain=sh(a));for(240==a.b&&V(a);;){f={C:{},type:0,next:null};null==g.list?g.list=f:e.next=f;e=f;if(202==a.b)if(V(a),k=a.b,dh(a),239!=k&&241!=k)f.type=108,f.C.code=rh(a);else{k=a.$[a.i];null==k&&U(a,a.i+" not defined");f.type=k.type;switch(k.type){case 111:f.C.Ca=k.link;break;case 122:f.C.set=k.link;break;case 120:f.C.W=k.link;break;case 127:f.C.A=k.link;a.Qb||U(a,"invalid reference to variable "+
f.C.A.name+" above solve statement");break;case 103:f.C.K=k.link,a.Qb||U(a,"invalid reference to "+(103==f.C.K.type?"constraint":"objective")+" "+f.C.K.name+" above solve statement")}V(a)}else f.type=108,f.C.code=rh(a);if(239==a.b)V(a);else break}null!=g.domain&&uh(a,g.domain);241!=a.b&&U(a,"syntax error in display statement");V(a);d.Ng=g}else if(eh(a,"printf")){c.type=121;d=c.C;f={domain:null,xd:null};f.list=g=null;V(a);248==a.b&&(f.domain=sh(a));240==a.b&&V(a);f.xd=mh(a);118==f.xd.type&&(f.xd=W(317,
f.xd,124,0));for(124!=f.xd.type&&U(a,"format expression has invalid type");239==a.b;)V(a),e={code:null,next:null},null==f.list?f.list=e:g.next=e,g=e,e.code=th(a),118!=e.code.type&&124!=e.code.type&&114!=e.code.type&&U(a,"only numeric, symbolic, or logical expression allowed");null!=f.domain&&uh(a,f.domain);f.Ia=null;f.app=0;if(234==a.b||250==a.b)f.app=250==a.b,V(a),f.Ia=mh(a),118==f.Ia.type&&(f.Ia=W(317,f.Ia,124,0)),124!=f.Ia.type&&U(a,"file name expression has invalid type");241!=a.b&&U(a,"syntax error in printf statement");
V(a);d.ih=f}else if(eh(a,"for")){c.type=109;d=c.C;f={domain:null};f.list=g=null;V(a);248!=a.b&&U(a,"indexing expression missing where expected");f.domain=sh(a);240==a.b&&V(a);if(248!=a.b)f.list=Rh(a,1);else{for(V(a);249!=a.b;)e=Rh(a,1),null==g?f.list=e:g.next=e,g=e;V(a)}uh(a,f.domain);d.Pg=f}else 202==a.b?(b&&U(a,"constraint statement not allowed here"),c.type=103,c.C.K=Oh(a)):fh(a)?U(a,"invalid use of reserved keyword "+a.i):U(a,"syntax error in model section");return c}
function Sh(a){var b,c;for(c=null;201!=a.b&&!eh(a,"data")&&!eh(a,"end");)b=Rh(a,0),null==c?a.uc=b:c.next=b,c=b}function Th(a,b){var c,d={};d.ba=b;d.next=null;if(null==a)a=d;else{for(c=a;null!=c.next;c=c.next);c.next=d}return a}function Uh(a){for(var b=0;null!=a;a=a.next)b++;return b}function Vh(a){for(var b=0;null!=a;a=a.next)null==a.ba&&b++;return b}function Wh(a){for(var b=null;0<a--;)b=Th(b,null);return b}function Xh(a){return 204==a.b||203==a.b||205==a.b}
function Qh(a,b){return Xh(a)&&a.i==b}function Yh(a){var b;b=204==a.b?Zh(a.value):$h(a.i);V(a);return b}
function ai(a,b,c){var d,e;switch(a.b){case 246:e=247;break;case 244:e=245}0==c&&U(a,b+" cannot be subscripted");V(a);for(d=null;;)if(Xh(a)?d=Th(d,Yh(a)):227==a.b?(d=Th(d,null),V(a)):U(a,"number, symbol, or asterisk missing where expected"),239==a.b)V(a);else if(a.b==e)break;else U(a,"syntax error in slice");if(Uh(d)!=c)switch(e){case 247:U(a,b+" must have "+c+" subscript"+(1==c?"":"s")+", not "+Uh(d));break;case 245:U(a,b+" has dimension "+c+", not "+Uh(d))}V(a);return d}
function bi(a,b){var c;c=a.$[b];null!=c&&122==c.type||U(a,b+" not a set");c=c.link;null==c.assign&&null==c.Xc||U(a,b+" needs no data");c.data=1;return c}function ci(a,b,c){var d,e,f=null;for(d=null;null!=c;c=c.next)null==c.ba?(Xh(a)||(e=Vh(c),1==e?U(a,"one item missing in data group beginning with "+di(f)):U(a,e+" items missing in data group beginning with "+di(f))),e=Yh(a),null==f&&(f=e)):e=ei(c.ba),d=fi(d,e),null!=c.next&&239==a.b&&V(a);gi(a,b.value.set,d)}
function hi(a,b,c,d){var e,f,g,k,h;for(e=null;242!=a.b;)Xh(a)||U(a,"number, symbol, or := missing where expected"),e=Th(e,Yh(a));for(V(a);Xh(a);)for(h=Yh(a),f=e;null!=f;f=f.next){var l=0;if(!Qh(a,"+"))if(Qh(a,"-")){V(a);continue}else g=Uh(f),1==g?U(a,"one item missing in data group beginning with "+di(h)):U(a,g+" items missing in data group beginning with "+di(h));k=null;for(g=c;null!=g;g=g.next)if(null==g.ba)switch(++l){case 1:k=fi(k,ei(d?f.ba:h));break;case 2:k=fi(k,ei(d?h:f.ba))}else k=fi(k,ei(g.ba));
gi(a,b.value.set,k);V(a)}}
function ii(a){function b(){U(a,"slice currently used must specify 2 asterisks, not "+Vh(k))}function c(){U(a,"transpose indicator (tr) incomplete")}function d(){V(a);Qh(a,"tr")||c();2!=Vh(k)&&b();V(a);245!=a.b&&c();V(a);240==a.b&&V(a);h=1;hi(a,g,k,h)}var e,f,g,k,h=0;V(a);Xh(a)||U(a,"set name missing where expected");e=bi(a,a.i);V(a);f=null;if(246==a.b){0==e.v&&U(a,e.name+" cannot be subscripted");for(V(a);;)if(Xh(a)||U(a,"number or symbol missing where expected"),f=fi(f,Yh(a)),239==a.b)V(a);else if(247==
a.b)break;else U(a,"syntax error in subscript list");e.v!=ji(f)&&U(a,e.name+" must have "+e.v+" subscript"+(1==e.v?"":"s")+" rather than "+ji(f));V(a)}else 0!=e.v&&U(a,e.name+" must be subscripted");null!=ki(a,e.T,f)&&U(a,e.name+li("[",f)+" already defined");g=mi(e.T,f);g.value.set=ni(a,117,e.aa);for(k=Wh(e.aa);;)if(239==a.b&&V(a),242==a.b)V(a);else if(244==a.b)V(a),f=Qh(a,"tr"),dh(a),f?d():(k=ai(a,e.name,e.aa),h=0,0==Vh(k)&&ci(a,g,k));else if(Xh(a))ci(a,g,k);else if(240==a.b)2!=Vh(k)&&b(),V(a),hi(a,
g,k,h);else if(244==a.b)d();else if(241==a.b){V(a);break}else U(a,"syntax error in set data block")}function oi(a,b){var c;c=a.$[b];null!=c&&120==c.type||U(a,b+" not a parameter");c=c.link;null!=c.assign&&U(a,b+" needs no data");c.data&&U(a,b+" already provided with data");c.data=1;return c}function pi(a,b,c){null!=b.Ba&&U(a,"default value for "+b.name+" already specified in model section");b.Vc=c}
function qi(a,b,c){null!=ki(a,b.T,c)&&U(a,b.name+li("[",c)+" already defined");c=mi(b.T,c);switch(b.type){case 118:case 113:case 101:204==a.b||U(a,b.name+" requires numeric data");b=c.value;c=a.value;V(a);b.U=c;break;case 124:c.value.ba=Yh(a)}}
function ri(a,b,c){var d,e,f=null;for(d=null;null!=c;c=c.next)null==c.ba?(Xh(a)||U(a,Vh(c)+1+" items missing in data group beginning with "+di(f)),e=Yh(a),null==f&&(f=e)):e=ei(c.ba),d=fi(d,e),239==a.b&&V(a);Xh(a)||U(a,"one item missing in data group beginning with "+di(f));qi(a,b,d)}
function si(a,b,c,d){var e,f,g,k,h;for(e=null;242!=a.b;)Xh(a)||U(a,"number, symbol, or := missing where expected"),e=Th(e,Yh(a));for(V(a);Xh(a);)for(h=Yh(a),f=e;null!=f;f=f.next){var l=0;if(Qh(a,"."))V(a);else{k=null;for(g=c;null!=g;g=g.next)if(null==g.ba)switch(++l){case 1:k=fi(k,ei(d?f.ba:h));break;case 2:k=fi(k,ei(d?h:f.ba))}else k=fi(k,ei(g.ba));Xh(a)||(g=Uh(f),1==g?U(a,"one item missing in data group beginning with "+di(h)):U(a,g+" items missing in data group beginning with "+di(h)));qi(a,b,
k)}}}
function ti(a,b){var c=null,d,e,f,g,k=0;g=null;Xh(a)&&(V(a),e=a.b,dh(a),240==e&&(c=bi(a,a.i),0!=c.v&&U(a,c.name+" must be a simple set"),null!=c.T.head&&U(a,c.name+" already defined"),mi(c.T,null).value.set=ni(a,117,c.aa),g=c.name,k=c.aa,V(a),V(a)));for(e=null;242!=a.b;)Xh(a)||U(a,"parameter name or := missing where expected"),d=oi(a,a.i),0==d.v&&U(a,a.i+" not a subscripted parameter"),0!=k&&d.v!=k&&U(a,g+" has dimension "+k+" while "+d.name+" has dimension "+d.v),null!=b&&pi(a,d,ei(b)),e=Th(e,d),
g=d.name,k=d.v,V(a),239==a.b&&V(a);0==Uh(e)&&U(a,"at least one parameter name required");V(a);for(239==a.b&&V(a);Xh(a);){g=null;for(f=1;f<=k;f++)Xh(a)||(d=Uh(e)+k-f+1,U(a,d+" items missing in data group beginning with "+di(g.ba))),g=fi(g,Yh(a)),f<k&&239==a.b&&V(a);null!=c&&gi(a,c.T.head.value.set,ui(g));239==a.b&&V(a);for(f=e;null!=f;f=f.next)Qh(a,".")?V(a):(Xh(a)||(d=Uh(f),1==d?U(a,"one item missing in data group beginning with "+di(g.ba)):U(a,d+" items missing in data group beginning with "+di(g.ba))),
qi(a,f.ba,ui(g)),null!=f.next&&239==a.b&&V(a));239==a.b&&(V(a),Xh(a)||dh(a))}for(f=e;null!=f;f=f.next)f.ba=null}
function vi(a){function b(){U(a,e.name+" not a subscripted parameter")}function c(){U(a,"slice currently used must specify 2 asterisks, not "+Vh(g))}function d(){U(a,"transpose indicator (tr) incomplete")}var e,f=null,g,k=0;V(a);Qh(a,"default")&&(V(a),Xh(a)||U(a,"default value missing where expected"),f=Yh(a),240!=a.b&&U(a,"colon missing where expected"));if(240==a.b)V(a),239==a.b&&V(a),ti(a,f),241!=a.b&&U(a,"symbol, number, or semicolon missing where expected"),V(a);else for(Xh(a)||U(a,"parameter name missing where expected"),
e=oi(a,a.i),V(a),Qh(a,"default")&&(V(a),Xh(a)||U(a,"default value missing where expected"),f=Yh(a),pi(a,e,f)),g=Wh(e.v);;)if(239==a.b&&V(a),242==a.b)V(a);else if(246==a.b)g=ai(a,e.name,e.v),k=0;else if(Xh(a))ri(a,e,g);else if(240==a.b)0==e.v&&b(),2!=Vh(g)&&c(),V(a),si(a,e,g,k);else if(244==a.b)V(a),Qh(a,"tr")||d(),0==e.v&&b(),2!=Vh(g)&&c(),V(a),245!=a.b&&d(),V(a),240==a.b&&V(a),k=1,si(a,e,g,k);else if(241==a.b){V(a);break}else U(a,"syntax error in parameter data block")}
function wi(a){for(;201!=a.b&&!Qh(a,"end");)Qh(a,"set")?ii(a):Qh(a,"param")?vi(a):U(a,"syntax error in data section")}function xi(a,b,c){(0<b&&0<c&&b>.999*t-c||0>b&&0>c&&b<-.999*t-c)&&U(a,b+" + "+c+"; floating-point overflow");return b+c}function yi(a,b,c){(0<b&&0>c&&b>.999*t+c||0>b&&0<c&&b<-.999*t+c)&&U(a,b+" - "+c+"; floating-point overflow");return b-c}function zi(a,b,c){if(b<c)return 0;0<b&&0>c&&b>.999*t+c&&U(a,b+" less "+c+"; floating-point overflow");return b-c}
function Ai(a,b,c){1<Math.abs(c)&&Math.abs(b)>.999*t/Math.abs(c)&&U(a,b+" * "+c+"; floating-point overflow");return b*c}function Bi(a,b,c){Math.abs(c)<fa&&U(a,b+" / "+c+"; floating-point zero divide");1>Math.abs(c)&&Math.abs(b)>.999*t*Math.abs(c)&&U(a,b+" / "+c+"; floating-point overflow");return b/c}
function Ci(a,b,c){Math.abs(c)<fa&&U(a,b+" div "+c+"; floating-point zero divide");1>Math.abs(c)&&Math.abs(b)>.999*t*Math.abs(c)&&U(a,b+" div "+c+"; floating-point overflow");b/=c;return 0<b?Math.floor(b):0>b?Math.ceil(b):0}function Di(a,b){var c;if(0==a)c=0;else if(0==b)c=a;else if(c=Math.abs(a)%Math.abs(b),0!=c&&(0>a&&(c=-c),0<a&&0>b||0>a&&0<b))c+=b;return c}
function Ei(a,b,c){(0==b&&0>=c||0>b&&c!=Math.floor(c))&&U(a,b+" ** "+c+"; result undefined");0==b?a=Math.pow(b,c):((1<Math.abs(b)&&1<c&&+Math.log(Math.abs(b))>.999*Math.log(t)/c||1>Math.abs(b)&&-1>c&&+Math.log(Math.abs(b))<.999*Math.log(t)/c)&&U(a,b+" ** "+c+"; floating-point overflow"),a=1<Math.abs(b)&&-1>c&&-Math.log(Math.abs(b))<.999*Math.log(t)/c||1>Math.abs(b)&&1<c&&-Math.log(Math.abs(b))>.999*Math.log(t)/c?0:Math.pow(b,c));return a}
function Fi(a,b){b>.999*Math.log(t)&&U(a,"exp("+b+"); floating-point overflow");return Math.exp(b)}function Gi(a,b){0>=b&&U(a,"log("+b+"); non-positive argument");return Math.log(b)}function Hi(a,b){0>=b&&U(a,"log10("+b+"); non-positive argument");return Math.log(b)/Math.LN10}function Ii(a,b){0>b&&U(a,"sqrt("+b+"); negative argument");return Math.sqrt(b)}function Ji(a,b){-1E6<=b&&1E6>=b||U(a,"sin("+b+"); argument too large");return Math.sin(b)}
function Ki(a,b){-1E6<=b&&1E6>=b||U(a,"cos("+b+"); argument too large");return Math.cos(b)}function Li(a){return Math.atan(a)}function Mi(a,b){return Math.atan2(a,b)}function Ni(a,b,c){c!=Math.floor(c)&&U(a,"round("+b+", "+c+"); non-integer second argument");18>=c&&(a=Math.pow(10,c),Math.abs(b)<.999*t/a&&(b=Math.floor(b*a+.5),0!=b&&(b/=a)));return b}
function Oi(a,b,c){c!=Math.floor(c)&&U(a,"trunc("+b+", "+c+"); non-integer second argument");18>=c&&(a=Math.pow(10,c),Math.abs(b)<.999*t/a&&(b=0<=b?Math.floor(b*a):Math.ceil(b*a),0!=b&&(b/=a)));return b}function Pi(a,b,c){var d;b>=c&&U(a,"Uniform("+b+", "+c+"); invalid range");d=Qi(a.Fd)/2147483648;return d=xi(a,b*(1-d),c*d)}function Ri(a){var b,c;do b=-1+2*(Qi(a.Fd)/2147483648),c=-1+2*(Qi(a.Fd)/2147483648),b=b*b+c*c;while(1<b||0==b);return c*Math.sqrt(-2*Math.log(b)/b)}
function Si(a,b,c){return xi(a,b,Ai(a,c,Ri(a)))}function Zh(a){var b={};b.U=a;b.P=null;return b}function $h(a){var b={U:0};b.P=a;return b}function ei(a){var b={};null==a.P?(b.U=a.U,b.P=null):(b.U=0,b.P=a.P);return b}function Ti(a,b){var c;if(null==a.P&&null==b.P)c=a.U<b.U?-1:a.U>b.U?1:0;else if(null==a.P)c=-1;else if(null==b.P)c=1;else{c=a.P;var d=b.P;c=c==d?0:c>d?1:-1}return c}
function di(a){var b;if(null==a.P)b=String(a.U);else{var c=function(a){255>e&&(b+=a,e++)},d,e,f=a.P;if(ua(f[0])||"_"==f[0])for(a=!1,d=1;d<f.length;d++){if(!(va(f[d])||0<="+-._".indexOf(f[d]))){a=!0;break}}else a=!0;b="";e=0;a&&c("'");for(d=0;d<f.length;d++)a&&"'"==f[d]&&c("'"),c(f[d]);a&&c("'");255==e&&(b=b.slice(0,252)+"...")}return b}function fi(a,b){var c,d={};d.ba=b;d.next=null;if(null==a)a=d;else{for(c=a;null!=c.next;c=c.next);c.next=d}return a}
function ji(a){for(var b=0;null!=a;a=a.next)b++;return b}function ui(a){var b,c;if(null==a)b=null;else{for(b=c={};null!=a;a=a.next)c.ba=ei(a.ba),null!=a.next&&(c=c.next={});c.next=null}return b}function Ui(a,b){var c,d,e;c=a;for(d=b;null!=c;c=c.next,d=d.next)if(e=Ti(c.ba,d.ba),0!=e)return e;return 0}function Vi(a,b){for(var c=null,d=1,e=a;d<=b;d++,e=e.next)c=fi(c,ei(e.ba));return c}
function li(a,b){function c(a){255>f&&(g+=a);f++}var d,e,f=0,g="",k="",h=ji(b);"["==a&&0<h&&c("[");"("==a&&1<h&&c("(");for(d=b;null!=d;d=d.next)for(d!=b&&c(","),k=di(d.ba),e=0;e<k.length;e++)c(k[e]);"["==a&&0<h&&c("]");"("==a&&1<h&&c(")");255==f&&(g=g.slice(0,252)+"...");return g}function Wi(a,b){mi(a,b).value.Zg=null}function gi(a,b,c){null!=ki(a,b,c)&&U(a,"duplicate tuple "+li("(",c)+" detected");Wi(b,c)}
function Xi(a,b){var c,d;c=ni(a,117,b.v);for(d=b.head;null!=d;d=d.next)Wi(c,ui(d.D));return c}function Yi(a,b,c,d){var e;0==d&&U(a,b+" .. "+c+" by "+d+"; zero stride not allowed");e=0<c&&0>b&&c>.999*t+b?+t:0>c&&0<b&&c<-.999*t+b?-t:c-b;1>Math.abs(d)&&Math.abs(e)>.999*t*Math.abs(d)?e=0<e&&0<d||0>e&&0>d?+t:0:(e=Math.floor(e/d)+1,0>e&&(e=0));2147483646<e&&U(a,b+" .. "+c+" by "+d+"; set too large");return e+.5|0}function Zi(a,b,c,d,e){1<=e&&Yi(a,b,c,d);return b+(e-1)*d}
function $i(a){var b;0==a?b=null:(b={},b.B=a,b.A=null,b.next=null);return b}function aj(a){var b,c;if(null==a)b=null;else{for(b=c={};null!=a;a=a.next)c.B=a.B,c.A=a.A,null!=a.next&&(c=c.next={});c.next=null}return b}
function bj(a,b,c,d,e){var f=null,g,k=0;for(g=c;null!=g;g=g.next)null==g.A?k=xi(a,k,Ai(a,b,g.B)):g.A.na=xi(a,g.A.na,Ai(a,b,g.B));for(g=e;null!=g;g=g.next)null==g.A?k=xi(a,k,Ai(a,d,g.B)):g.A.na=xi(a,g.A.na,Ai(a,d,g.B));for(g=c;null!=g;g=g.next)null!=g.A&&0!=g.A.na&&(a={},a.B=g.A.na,a.A=g.A,a.next=f,f=a,g.A.na=0);for(g=e;null!=g;g=g.next)null!=g.A&&0!=g.A.na&&(a={},a.B=g.A.na,a.A=g.A,a.next=f,f=a,g.A.na=0);0!=k&&(a={},a.B=k,a.A=null,a.next=f,f=a);return f}
function cj(a,b,c){for(var d=null,e,f=0;null!=b;)e=b,b=b.next,null==e.A?f=xi(a,f,e.B):(e.next=d,d=e);c(f);return d}function dj(a,b){switch(a){case 117:b.Zg=null;break;case 118:b.U=0;break;case 124:b.ba=null;break;case 114:b.og=0;break;case 126:b.D=null;break;case 106:b.set=null;break;case 107:b.A=null;break;case 110:b.form=null;break;case 105:b.K=null}}function ni(a,b,c){var d={};d.type=b;d.v=c;d.size=0;d.head=null;d.$a=null;d.$=!1;d.ga=null;d.next=a.lg;null!=d.next&&(d.next.ga=d);return a.lg=d}
function ej(a,b,c){return Ui(b,c)}function ki(a,b,c){if(30<b.size&&!b.$){var d={root:null};d.ug=ej;d.info=a;d.size=0;d.height=0;b.$=d;for(a=b.head;null!=a;a=a.next)qe(b.$,a.D).link=a}if(b.$){b=b.$;for(a=b.root;null!=a;){d=b.ug(b.info,c,a.key);if(0==d)break;a=0>d?a.left:a.right}c=a;a=null==c?null:c.link}else for(a=b.head;null!=a&&0!=Ui(a.D,c);a=a.next);return a}
function mi(a,b){var c={};c.D=b;c.next=null;c.value={};a.size++;null==a.head?a.head=c:a.$a.next=c;a.$a=c;null!=a.$&&(qe(a.$,c.D).link=c);return c}function fj(a){var b;if(null!=a.Je)for(b=a.list,a=a.Je;null!=b;b=b.next,a=a.next)a:{var c=b,d=a.ba,e=void 0,f=void 0;if(null!=c.value){if(0==Ti(c.value,d))break a;c.value=null}for(e=c.list;null!=e;e=e.a.index.next)for(f=e;null!=f;f=f.V)f.valid&&(f.valid=0,dj(f.type,f.value));c.value=ei(d)}}
function gj(a,b,c,d,e){var f,g=0;if(!hj(a,b.code,c))return 1;f=b.Je;b.Je=c;fj(b);e(a,d);b.Je=f;fj(b);return g}function ij(a,b){if(null!=b.block){var c,d,e=null,f=null;c=b.block;b.block=c.next;for(d=c.list;null!=d;d=d.next)null==e?e=f={}:f=f.next={},null==d.code?(f.ba=b.D.ba,b.D=b.D.next):f.ba=jj(a,d.code);f.next=null;gj(a,c,e,b,ij)&&(b.Te=1);for(d=c.list;null!=d;d=d.next)e=e.next}else null==b.domain.code||kj(a,b.domain.code)?b.Xd(a,b.info):b.Te=2}
function lj(a,b,c,d,e){var f={};null==b?(e(a,d),f.Te=0):(f.domain=b,f.block=b.list,f.D=c,f.info=d,f.Xd=e,f.Te=0,ij(a,f));return f.Te}
function mj(a,b){if(null!=b.block){var c,d,e;c=b.block;b.block=c.next;e=null;for(d=c.list;null!=d;d=d.next)null!=d.code&&(e=fi(e,jj(a,d.code)));if(372==c.code.Wa){var f,g,k,h;g=X(a,c.code.a.a.x);k=X(a,c.code.a.a.y);null==c.code.a.a.z?h=1:h=X(a,c.code.a.a.z);e=Yi(a,g,k,h);d=fi(null,Zh(0));for(f=1;f<=e&&b.Sf;f++)d.ba.U=Zi(a,g,k,h,f),gj(a,c,d,b,mj)}else for(h=nj(a,c.code).head;null!=h&&b.Sf;h=h.next){f=h.D;g=e;k=!1;for(d=c.list;null!=d;d=d.next){if(null!=d.code){if(0!=Ti(f.ba,g.ba)){k=!0;break}g=g.next}f=
f.next}k||gj(a,c,h.D,b,mj)}b.block=c}else if(null==b.domain.code||kj(a,b.domain.code))b.Sf=!b.Xd(a,b.info)}function oj(a,b,c,d){var e={};null==b?d(a,c):(e.domain=b,e.block=b.list,e.Sf=1,e.info=c,e.Xd=d,mj(a,e))}function pj(a,b,c){U(a,b+li("[",c)+" out of domain")}function qj(a){var b=null;if(null!=a)for(a=a.list;null!=a;a=a.next)for(var c=a.list;null!=c;c=c.next)null==c.code&&(b=fi(b,ei(c.value)));return b}
function rj(a,b,c,d){for(var e=b.xf,f=1;null!=e;e=e.next,f++)for(var g=d.head;null!=g;g=g.next)if(!hj(a,e.code,g.D)){var k=li("(",g.D);U(a,b.name+li("[",c)+" contains "+k+" which not within specified set; see ("+f+")")}}function sj(a,b,c){function d(){rj(a,b,c,e);f=mi(b.T,ui(c));f.value.set=e}var e,f=ki(a,b.T,c);null!=f?e=f.value.set:null!=b.assign?(e=nj(a,b.assign),d()):null!=b.Ba?(e=nj(a,b.Ba),d()):U(a,"no value for "+b.name+li("[",c));return e}
function tj(a,b){null!=b.ka?rj(a,b.set,b.ka.D,b.ka.value.set):b.me=sj(a,b.set,b.D)}
function uj(a,b){var c=b.Xc,d,e,f,g=Array(20);y("Generating "+b.name+"...");d=c.set;oj(a,d.domain,d,vj);for(d=c.set.T.head.value.set.head;null!=d;d=d.next){f=ui(d.D);for(e=0;e<c.set.aa;e++)g[e]=null;for(e=0;null!=f;f=f.next)g[c.ca[e++]-1]=f;for(e=0;e<c.set.aa;e++)g[e].next=g[e+1];0==b.v?f=null:(f=g[0],g[b.v-1].next=null);e=ki(a,b.T,f);null==e&&(e=mi(b.T,f),e.value.set=ni(a,117,b.aa));f=g[b.v];g[c.set.aa-1].next=null;Wi(e.value.set,f)}b.data=1}
function wj(a,b,c){var d={};d.set=b;d.D=c;null!=b.Xc&&0==b.data&&uj(a,b);if(1==b.data)for(c=b.T.$a,b.data=2,d.ka=b.T.head;null!=d.ka&&(lj(a,b.domain,d.ka.D,d,tj)&&pj(a,b.name,d.ka.D),d.ka!=c);d.ka=d.ka.next);d.ka=null;lj(a,d.set.domain,d.D,d,tj)&&pj(a,b.name,d.D);return d.me}function vj(a,b){var c=qj(b.domain);wj(a,b,c);return 0}
function xj(a,b,c,d){var e,f;switch(b.type){case 113:d!=Math.floor(d)&&U(a,b.name+li("[",c)+" = "+d+" not integer");break;case 101:0!=d&&1!=d&&U(a,b.name+li("[",c)+" = "+d+" not binary")}e=b.ud;for(f=1;null!=e;e=e.next,f++){var g=function(e){U(a,b.name+li("[",c)+" = "+d+" not "+e+" "+k+"; see ("+f+")")},k;k=X(a,e.code);switch(e.hd){case 352:d<k||g("<");break;case 353:d<=k||g("<=");break;case 354:d!=k&&g("=");break;case 355:d>=k||g(">=");break;case 356:d>k||g(">");break;case 357:d==k&&g("<>")}}f=1;
for(e=b.ua;null!=e;e=e.next,f++)g=fi(null,Zh(d)),hj(a,e.code,g)||U(a,b.name+li("[",c)+" = "+d+" not in specified set; see ("+f+")")}function yj(a,b,c){function d(d){xj(a,b,c,d);e=mi(b.T,ui(c));return e.value.U=d}var e=ki(a,b.T,c);return null!=e?e.value.U:null!=b.assign?d(X(a,b.assign)):null!=b.Ba?d(X(a,b.Ba)):null!=b.Vc?(null!=b.Vc.P&&U(a,"cannot convert "+di(b.Vc)+" to floating-point number"),d(b.Vc.U)):U(a,"no value for "+b.name+li("[",c))}
function zj(a,b){null!=b.ka?xj(a,b.W,b.ka.D,b.ka.value.U):b.value=yj(a,b.W,b.D)}function Aj(a,b,c){var d={};d.W=b;d.D=c;if(1==b.data)for(c=b.T.$a,b.data=2,d.ka=b.T.head;null!=d.ka&&(lj(a,b.domain,d.ka.D,d,zj)&&pj(a,b.name,d.ka.D),d.ka!=c);d.ka=d.ka.next);d.ka=null;lj(a,d.W.domain,d.D,d,zj)&&pj(a,b.name,d.D);return d.value}
function Bj(a,b,c,d){var e,f=1;for(e=b.ud;null!=e;e=e.next,f++){var g;g=jj(a,e.code);switch(e.hd){case 352:0>Ti(d,g)||(g=di(g),U(a,b.name+li("[",c)+" = "+di(d)+" not < "+g));break;case 353:0>=Ti(d,g)||(g=di(g),U(a,b.name+li("[",c)+" = "+di(d)+" not <= "+g));break;case 354:0!=Ti(d,g)&&(g=di(g),U(a,b.name+li("[",c)+" = "+di(d)+" not = "+g));break;case 355:0<=Ti(d,g)||(g=di(g),U(a,b.name+li("[",c)+" = "+di(d)+" not >= "+g));break;case 356:0<Ti(d,g)||(g=di(g),U(a,b.name+li("[",c)+" = "+di(d)+" not > "+
g));break;case 357:0==Ti(d,g)&&(g=di(g),U(a,b.name+li("[",c)+" <> "+di(d)+" not > "+g))}}f=1;for(e=b.ua;null!=e;e=e.next,f++)g=fi(null,ei(d)),hj(a,e.code,g)||U(a,b.name,li("[",c)+" = "+di(d)+" not in specified set; see ("+f+")")}function Cj(a,b,c){function d(d){Bj(a,b,c,d);e=mi(b.T,ui(c));e.value.ba=ei(d);return d}var e=ki(a,b.T,c);return null!=e?ei(e.value.ba):null!=b.assign?d(jj(a,b.assign)):null!=b.Ba?d(jj(a,b.Ba)):null!=b.Vc?ei(b.Vc):U(a,"no value for "+b.name+li("[",c))}
function Dj(a,b){null!=b.ka?Bj(a,b.W,b.ka.D,b.ka.value.ba):b.value=Cj(a,b.W,b.D)}function Ej(a,b,c){var d={};d.W=b;d.D=c;if(1==b.data)for(c=b.T.$a,b.data=2,d.ka=b.T.head;null!=d.ka&&(lj(a,b.domain,d.ka.D,d,Dj)&&pj(a,b.name,d.ka.D),d.ka!=c);d.ka=d.ka.next);d.ka=null;lj(a,d.W.domain,d.D,d,Dj)&&pj(a,b.name,d.D);return d.value}function Fj(a,b){var c=qj(b.domain);switch(b.type){case 118:case 113:case 101:Aj(a,b,c);break;case 124:Ej(a,b,c)}return 0}
function Gj(a,b){var c=b.A,d=b.D,e=ki(a,c.T,d);null!=e?d=e.value.A:(e=mi(c.T,ui(d)),d=e.value.A={},d.H=0,d.A=c,d.ka=e,null==c.S?d.S=0:d.S=X(a,c.S),null==c.Z?d.Z=0:c.Z==c.S?d.Z=d.S:d.Z=X(a,c.Z),d.na=0,d.stat=0,d.w=d.M=0);b.me=d}function Hj(a,b,c){var d={};d.A=b;d.D=c;lj(a,d.A.domain,d.D,d,Gj)&&pj(a,b.name,d.D);return d.me}
function Ij(a,b,c){var d=null,e=ki(a,b.T,c);if(null!=e)c=e.value.K;else{e=mi(b.T,ui(c));c=e.value.K={};c.ia=0;c.K=b;c.ka=e;c.form=Jj(a,b.code);if(null==b.S&&null==b.Z)c.form=cj(a,c.form,function(a){d=a}),c.S=c.Z=-d;else if(null!=b.S&&null==b.Z)c.form=bj(a,1,c.form,-1,Jj(a,b.S)),c.form=cj(a,c.form,function(a){d=a}),c.S=-d,c.Z=0;else if(null==b.S&&null!=b.Z)c.form=bj(a,1,c.form,-1,Jj(a,b.Z)),c.form=cj(a,c.form,function(a){d=a}),c.S=0,c.Z=-d;else if(b.S==b.Z)c.form=bj(a,1,c.form,-1,Jj(a,b.S)),c.form=
cj(a,c.form,function(a){d=a}),c.S=c.Z=-d;else{var f=null,g=null;c.form=cj(a,c.form,function(a){d=a});cj(a,Jj(a,b.S),function(a){f=a});cj(a,Jj(a,b.Z),function(a){g=a});c.S=yi(a,f,d);c.Z=yi(a,g,d)}c.stat=0;c.w=c.M=0}return c}function Kj(a,b){b.me=Ij(a,b.K,b.D)}function Lj(a,b,c){var d={};d.K=b;d.D=c;lj(a,d.K.domain,d.D,d,Kj)&&pj(a,b.name,d.D);return d.me}function Mj(a,b){var c=qj(b.domain);Lj(a,b,c);return 0}
function Nj(a,b){var c=X(a,b.code.a.loop.x);switch(b.code.Wa){case 377:b.value=xi(a,b.value,c);break;case 378:b.value=Ai(a,b.value,c);break;case 379:b.value>c&&(b.value=c);break;case 380:b.value<c&&(b.value=c)}return 0}
function X(a,b){var c,d,e;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return b.value.U;switch(b.Wa){case 301:c=b.a.U;break;case 304:d=null;for(e=b.a.W.list;null!=e;e=e.next)d=fi(d,jj(a,e.x));c=Aj(a,b.a.W.W,d);break;case 307:d=null;for(e=b.a.A.list;null!=e;e=e.next)d=fi(d,jj(a,e.x));e=Hj(a,b.a.A.A,d);switch(b.a.A.Ac){case 1:null==e.A.S?c=-t:c=e.S;break;case 2:null==e.A.Z?c=+t:c=e.Z;break;case 3:c=e.stat;break;case 4:c=e.w;break;case 5:c=e.M}break;case 308:d=null;for(e=b.a.K.list;null!=
e;e=e.next)d=fi(d,jj(a,e.x));e=Lj(a,b.a.K.K,d);switch(b.a.K.Ac){case 1:null==e.K.S?c=-t:c=e.S;break;case 2:null==e.K.Z?c=+t:c=e.Z;break;case 3:c=e.stat;break;case 4:c=e.w;break;case 5:c=e.M}break;case 312:c=Oj(a.Fd);break;case 313:c=Qi(a.Fd)/2147483648;break;case 314:c=Ri(a);break;case 315:c=Math.round(Date.now()/1E3);break;case 316:e=jj(a,b.a.a.x);null==e.P?c=e.U:tg(e.P,function(a){c=a})&&U(a,"cannot convert "+di(e)+" to floating-point number");break;case 321:c=+X(a,b.a.a.x);break;case 322:c=-X(a,
b.a.a.x);break;case 324:c=Math.abs(X(a,b.a.a.x));break;case 325:c=Math.ceil(X(a,b.a.a.x));break;case 326:c=Math.floor(X(a,b.a.a.x));break;case 327:c=Fi(a,X(a,b.a.a.x));break;case 328:c=Gi(a,X(a,b.a.a.x));break;case 329:c=Hi(a,X(a,b.a.a.x));break;case 330:c=Ii(a,X(a,b.a.a.x));break;case 331:c=Ji(a,X(a,b.a.a.x));break;case 332:c=Ki(a,X(a,b.a.a.x));break;case 333:c=Li(X(a,b.a.a.x));break;case 346:c=Mi(X(a,b.a.a.x),X(a,b.a.a.y));break;case 334:c=Ni(a,X(a,b.a.a.x),0);break;case 347:c=Ni(a,X(a,b.a.a.x),
X(a,b.a.a.y));break;case 335:c=Oi(a,X(a,b.a.a.x),0);break;case 348:c=Oi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 338:c=xi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 339:c=yi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 340:c=zi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 341:c=Ai(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 342:c=Bi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 343:c=Ci(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 344:c=Di(X(a,b.a.a.x),X(a,b.a.a.y));break;case 345:c=Ei(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 349:c=
Pi(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 350:c=Si(a,X(a,b.a.a.x),X(a,b.a.a.y));break;case 336:c=nj(a,b.a.a.x).size;break;case 337:e=jj(a,b.a.a.x);null==e.P?d=String(e.U):d=e.P;c=d.length;break;case 370:var f;e=jj(a,b.a.a.x);null==e.P?d=String(e.U):d=e.P;e=jj(a,b.a.a.y);null==e.P?f=String(e.U):f=e.P;c=Pj(a,d,f);break;case 373:kj(a,b.a.a.x)?c=X(a,b.a.a.y):null==b.a.a.z?c=0:c=X(a,b.a.a.z);break;case 375:c=+t;for(e=b.a.list;null!=e;e=e.next)d=X(a,e.x),c>d&&(c=d);break;case 376:c=-t;for(e=b.a.list;null!=
e;e=e.next)d=X(a,e.x),c<d&&(c=d);break;case 377:e={};e.code=b;e.value=0;oj(a,b.a.loop.domain,e,Nj);c=e.value;break;case 378:e={};e.code=b;e.value=1;oj(a,b.a.loop.domain,e,Nj);c=e.value;break;case 379:e={};e.code=b;e.value=+t;oj(a,b.a.loop.domain,e,Nj);e.value==+t&&U(a,"min{} over empty set; result undefined");c=e.value;break;case 380:e={},e.code=b,e.value=-t,oj(a,b.a.loop.domain,e,Nj),e.value==-t&&U(a,"max{} over empty set; result undefined"),c=e.value}b.valid=1;return b.value.U=c}
function jj(a,b){var c,d;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return ei(b.value.ba);switch(b.Wa){case 302:c=$h(b.a.P);break;case 303:c=ei(b.a.index.Ca.value);break;case 305:var e,f;e=null;for(f=b.a.W.list;null!=f;f=f.next)e=fi(e,jj(a,f.x));c=Ej(a,b.a.W.W,e);break;case 317:c=Zh(X(a,b.a.a.x));break;case 351:var g=jj(a,b.a.a.x);d=jj(a,b.a.a.y);null==g.P?e=String(g.U):e=g.P;null==d.P?f=String(d.U):f=d.P;c=$h(e+f);break;case 373:c=kj(a,b.a.a.x)?jj(a,b.a.a.y):null==b.a.a.z?Zh(0):jj(a,
b.a.a.z);break;case 369:case 374:var k;c=jj(a,b.a.a.x);null==c.P?d=String(c.U):d=c.P;369==b.Wa?(e=X(a,b.a.a.y),e!=Math.floor(e)&&U(a,"substr('...', "+e+"); non-integer second argument"),(1>e||e>d.length+1)&&U(a,"substr('...', "+e+"); substring out of range")):(e=X(a,b.a.a.y),k=X(a,b.a.a.z),e==Math.floor(e)&&k==Math.floor(k)||U(a,"substr('...', "+e+", "+k+"); non-integer second and/or third argument"),(1>e||0>k||e+k>d.length+1)&&U(a,"substr('...', "+e+", "+k+"); substring out of range"));c=$h(d.slice(e-
1,e+k-1));break;case 371:e=X(a,b.a.a.x),f=jj(a,b.a.a.y),null==f.P?g=String(f.U):g=f.P,d=Qj(a,e,g),c=$h(d)}b.valid=1;b.value.ba=ei(c);return c}function Rj(a,b){var c=0;switch(b.code.Wa){case 381:b.value&=kj(a,b.code.a.loop.x);b.value||(c=1);break;case 382:b.value|=kj(a,b.code.a.loop.x),b.value&&(c=1)}return c}
function kj(a,b){var c,d;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return b.value.og;switch(b.Wa){case 318:c=0!=X(a,b.a.a.x);break;case 323:c=!kj(a,b.a.a.x);break;case 352:118==b.a.a.x.type?c=X(a,b.a.a.x)<X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0>Ti(c,d));break;case 353:118==b.a.a.x.type?c=X(a,b.a.a.x)<=X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0>=Ti(c,d));break;case 354:118==b.a.a.x.type?c=X(a,b.a.a.x)==X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0==Ti(c,d));break;
case 355:118==b.a.a.x.type?c=X(a,b.a.a.x)>=X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0<=Ti(c,d));break;case 356:118==b.a.a.x.type?c=X(a,b.a.a.x)>X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0<Ti(c,d));break;case 357:118==b.a.a.x.type?c=X(a,b.a.a.x)!=X(a,b.a.a.y):(c=jj(a,b.a.a.x),d=jj(a,b.a.a.y),c=0!=Ti(c,d));break;case 358:c=kj(a,b.a.a.x)&&kj(a,b.a.a.y);break;case 359:c=kj(a,b.a.a.x)||kj(a,b.a.a.y);break;case 365:c=Sj(a,b.a.a.x);c=hj(a,b.a.a.y,c);break;case 366:c=Sj(a,b.a.a.x);c=!hj(a,b.a.a.y,
c);break;case 367:d=nj(a,b.a.a.x);c=1;for(d=d.head;null!=d;d=d.next)if(!hj(a,b.a.a.y,d.D)){c=0;break}break;case 368:d=nj(a,b.a.a.x);c=1;for(d=d.head;null!=d;d=d.next)if(hj(a,b.a.a.y,d.D)){c=0;break}break;case 381:c={};c.code=b;c.value=1;oj(a,b.a.loop.domain,c,Rj);c=c.value;break;case 382:c={},c.code=b,c.value=0,oj(a,b.a.loop.domain,c,Rj),c=c.value}b.valid=1;return b.value.og=c}
function Sj(a,b){var c;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return ui(b.value.D);switch(b.Wa){case 309:c=null;for(var d=b.a.list;null!=d;d=d.next)c=fi(c,jj(a,d.x));break;case 319:c=fi(null,jj(a,b.a.a.x))}b.valid=1;b.value.D=ui(c);return c}function Tj(a,b){var c;switch(b.code.Wa){case 383:c=Sj(a,b.code.a.loop.x);null==ki(a,b.value,c)&&Wi(b.value,c);break;case 384:Wi(b.value,qj(b.code.a.loop.domain))}return 0}
function nj(a,b){var c,d;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return Xi(a,b.value.set);switch(b.Wa){case 306:c=null;for(d=b.a.set.list;null!=d;d=d.next)c=fi(c,jj(a,d.x));c=Xi(a,wj(a,b.a.set.set,c));break;case 310:c=ni(a,117,b.v);for(d=b.a.list;null!=d;d=d.next)gi(a,c,Sj(a,d.x));break;case 360:d=nj(a,b.a.a.x);for(c=nj(a,b.a.a.y).head;null!=c;c=c.next)null==ki(a,d,c.D)&&Wi(d,ui(c.D));c=d;break;case 361:var e=nj(a,b.a.a.x);d=nj(a,b.a.a.y);c=ni(a,117,e.v);for(e=e.head;null!=e;e=e.next)null==
ki(a,d,e.D)&&Wi(c,ui(e.D));break;case 362:d=nj(a,b.a.a.x);c=nj(a,b.a.a.y);for(var f=ni(a,117,d.v),e=d.head;null!=e;e=e.next)null==ki(a,c,e.D)&&Wi(f,ui(e.D));for(e=c.head;null!=e;e=e.next)null==ki(a,d,e.D)&&Wi(f,ui(e.D));c=f;break;case 363:e=nj(a,b.a.a.x);d=nj(a,b.a.a.y);c=ni(a,117,e.v);for(e=e.head;null!=e;e=e.next)null!=ki(a,d,e.D)&&Wi(c,ui(e.D));break;case 364:e=nj(a,b.a.a.x);d=nj(a,b.a.a.y);var g,k;c=ni(a,117,e.v+d.v);for(e=e.head;null!=e;e=e.next)for(f=d.head;null!=f;f=f.next){g=ui(e.D);for(k=
f.D;null!=k;k=k.next)g=fi(g,ei(k.ba));Wi(c,g)}break;case 372:d=X(a,b.a.a.x);c=X(a,b.a.a.y);e=null==b.a.a.z?1:X(a,b.a.a.z);f=ni(a,117,1);g=Yi(a,d,c,e);for(k=1;k<=g;k++)Wi(f,fi(null,Zh(Zi(a,d,c,e,k))));c=f;break;case 373:c=kj(a,b.a.a.x)?nj(a,b.a.a.y):nj(a,b.a.a.z);break;case 383:d={};d.code=b;d.value=ni(a,117,b.v);oj(a,b.a.loop.domain,d,Tj);c=d.value;break;case 384:d={},d.code=b,d.value=ni(a,117,b.v),oj(a,b.a.loop.domain,d,Tj),c=d.value}b.valid=1;b.value.set=Xi(a,c);return c}function Uj(){}
function hj(a,b,c){var d,e,f;switch(b.Wa){case 306:f=null;for(e=b.a.set.list;null!=e;e=e.next)f=fi(f,jj(a,e.x));b=wj(a,b.a.set.set,f);f=Vi(c,b.v);d=null!=ki(a,b,f);break;case 310:d=0;f=Vi(c,b.v);for(e=b.a.list;null!=e&&!(c=Sj(a,e.x),d=0==Ui(f,c));e=e.next);break;case 360:d=hj(a,b.a.a.x,c)||hj(a,b.a.a.y,c);break;case 361:d=hj(a,b.a.a.x,c)&&!hj(a,b.a.a.y,c);break;case 362:f=hj(a,b.a.a.x,c);a=hj(a,b.a.a.y,c);d=f&&!a||!f&&a;break;case 363:d=hj(a,b.a.a.x,c)&&hj(a,b.a.a.y,c);break;case 364:if(d=hj(a,b.a.a.x,
c)){for(f=1;f<=b.a.a.x.v;f++)c=c.next;d=hj(a,b.a.a.y,c)}break;case 372:d=X(a,b.a.a.x);e=X(a,b.a.a.y);null==b.a.a.z?f=1:f=X(a,b.a.a.z);Yi(a,d,e,f);if(null!=c.ba.P){d=0;break}c=c.ba.U;if(0<f&&!(d<=c&&c<=e)||0>f&&!(e<=c&&c<=d)){d=0;break}d=Zi(a,d,e,f,((c-d)/f+.5|0)+1)==c;break;case 373:d=kj(a,b.a.a.x)?hj(a,b.a.a.y,c):hj(a,b.a.a.z,c);break;case 383:U(a,"implementation restriction; in/within setof{} not allowed");break;case 384:f=Vi(c,b.v),d=0==lj(a,b.a.loop.domain,f,null,Uj)}return d}
function Vj(a,b){switch(b.code.Wa){case 377:var c;c=Jj(a,b.code.a.loop.x);for(null==b.value?b.value=c:b.$a.next=c;null!=c;c=c.next)b.$a=c}return 0}
function Jj(a,b){var c;b.X&&b.valid&&(b.valid=0,dj(b.type,b.value));if(b.valid)return aj(b.value.form);switch(b.Wa){case 307:var d=null;for(c=b.a.A.list;null!=c;c=c.next)d=fi(d,jj(a,c.x));c=Hj(a,b.a.A.A,d);d={B:1};d.A=c;d.next=null;c=d;break;case 320:c=$i(X(a,b.a.a.x));break;case 321:c=bj(a,0,$i(0),1,Jj(a,b.a.a.x));break;case 322:c=bj(a,0,$i(0),-1,Jj(a,b.a.a.x));break;case 338:c=bj(a,1,Jj(a,b.a.a.x),1,Jj(a,b.a.a.y));break;case 339:c=bj(a,1,Jj(a,b.a.a.x),-1,Jj(a,b.a.a.y));break;case 341:c=118==b.a.a.x.type?
bj(a,X(a,b.a.a.x),Jj(a,b.a.a.y),0,$i(0)):bj(a,X(a,b.a.a.y),Jj(a,b.a.a.x),0,$i(0));break;case 342:c=bj(a,Bi(a,1,X(a,b.a.a.y)),Jj(a,b.a.a.x),0,$i(0));break;case 373:c=kj(a,b.a.a.x)?Jj(a,b.a.a.y):null==b.a.a.z?$i(0):Jj(a,b.a.a.z);break;case 377:c={};c.code=b;c.value=$i(0);c.$a=null;oj(a,b.a.loop.domain,c,Vj);c=c.value;for(var e,f=0,d=c;null!=d;d=d.next)null==d.A?f=xi(a,f,d.B):d.A.na=xi(a,d.A.na,d.B);e=c;c=null;for(d=e;null!=d;d=e)e=d.next,null==d.A&&0!=f?(d.B=f,f=0,d.next=c,c=d):null!=d.A&&0!=d.A.na&&
(d.B=d.A.na,d.A.na=0,d.next=c,c=d)}b.valid=1;b.value.form=aj(c);return c}var Wj=exports.mpl_tab_num_args=function(a){return a.df},Xj=exports.mpl_tab_get_arg=function(a,b){return a.a[b]};exports.mpl_tab_get_args=function(a){return a.a};
var Yj=exports.mpl_tab_num_flds=function(a){return a.Za},Zj=exports.mpl_tab_get_name=function(a,b){return a.name[b]},ak=exports.mpl_tab_get_type=function(a,b){return a.type[b]},bk=exports.mpl_tab_get_num=function(a,b){return a.U[b]},ck=exports.mpl_tab_get_str=function(a,b){return a.P[b]},dk=exports.mpl_tab_set_num=function(a,b,c){a.type[b]="N";a.U[b]=c},ek=exports.mpl_tab_set_str=function(a,b,c){a.type[b]="S";a.P[b]=c};
function fk(a,b){var c=a.Lc,d,e,f;f=0;for(d=b.C.Nc.list;null!=d;d=d.next)switch(f++,d.code.type){case 118:c.type[f]="N";c.U[f]=X(a,d.code);c.P[f][0]="\x00";break;case 124:e=jj(a,d.code),null==e.P?(c.type[f]="N",c.U[f]=e.U,c.P[f][0]="\x00"):(c.type[f]="S",c.U[f]=0,c.P[f]=e.P)}c=a.Lc;c.link.writeRecord(c)&&U(a,"error on writing data to table "+a.lb.C.tab.name);return 0}function gk(a,b){kj(a,b.code)||U(a,"check"+li("[",qj(b.domain))+" failed");return 0}
function hk(a,b,c){var d=c.value.set;ik(a,b.name+li("[",c.D)+(null==d.head?" is empty":":"));for(b=d.head;null!=b;b=b.next)ik(a,"   "+li("(",b.D))}function jk(a,b,c){switch(b.type){case 118:case 113:case 101:ik(a,b.name+li("[",c.D)+" = "+c.value.U);break;case 124:ik(a,b.name+li("[",c.D)+" = "+di(c.value.ba))}}
function kk(a,b,c,d){0==d||4==d?ik(a,b.name+li("[",c.D)+".val = "+c.value.A.w):1==d?ik(a,b.name+li("[",c.D)+".lb = "+(null==c.value.A.A.S?-t:c.value.A.S)):2==d?ik(a,b.name+li("[",c.D)+".ub = "+(null==c.value.A.A.Z?+t:c.value.A.Z)):3==d?ik(a,b.name+li("[",c.D)+".status = "+c.value.A.stat):5==d&&ik(a,b.name+li("[",c.D)+".dual = "+c.value.A.M)}
function lk(a,b,c,d){0==d||4==d?ik(a,b.name+li("[",c.D)+".val = "+c.value.K.w):1==d?ik(a,b.name+li("[",c.D)+".lb = "+(null==c.value.K.K.S?-t:c.value.K.S)):2==d?ik(a,b.name+li("[",c.D)+".ub = "+(null==c.value.K.K.Z?+t:c.value.K.Z)):3==d?ik(a,b.name+li("[",c.D)+".status = "+c.value.K.stat):5==d&&ik(a,b.name+li("[",c.D)+".dual = "+c.value.K.M)}
function mk(a,b){for(var c,d=b.list;null!=d;d=d.next)if(111==d.type)c=d.C.Ca,ik(a,c.name+" = "+di(c.value));else if(122==d.type){var e=d.C.set;null!=e.assign?oj(a,e.domain,e,vj):(null!=e.Xc&&0==e.data&&uj(a,e),null!=e.T.head&&wj(a,e,e.T.head.D));null==e.T.head&&ik(a,e.name+" has empty content");for(c=e.T.head;null!=c;c=c.next)hk(a,e,c)}else if(120==d.type)for(e=d.C.W,null!=e.assign?oj(a,e.domain,e,Fj):null!=e.T.head&&(124!=e.type?Aj(a,e,e.T.head.D):Ej(a,e,e.T.head.D)),null==e.T.head&&ik(a,e.name+
" has empty content"),c=e.T.head;null!=c;c=c.next)jk(a,e,c);else if(127==d.type)for(e=d.C.A,null==e.T.head&&ik(a,e.name+" has empty content"),c=e.T.head;null!=c;c=c.next)kk(a,e,c,0);else if(103==d.type)for(e=d.C.K,null==e.T.head&&ik(a,e.name+" has empty content"),c=e.T.head;null!=c;c=c.next)lk(a,e,c,0);else if(108==d.type)if(e=d.C.code,304==e.Wa||305==e.Wa||306==e.Wa||307==e.Wa||308==e.Wa){c=a;var f={value:{}},g=void 0;f.D=null;for(g=e.a.W.list||e.a.A.list;null!=g;g=g.next)f.D=fi(f.D,jj(c,g.x));switch(e.Wa){case 304:f.value.U=
Aj(c,e.a.W.W,f.D);jk(c,e.a.W.W,f);break;case 305:f.value.ba=Ej(c,e.a.W.W,f.D);jk(c,e.a.W.W,f);break;case 306:f.value.set=wj(c,e.a.set.set,f.D);hk(c,e.a.set.set,f);break;case 307:f.value.A=Hj(c,e.a.A.A,f.D);kk(c,e.a.A.A,f,e.a.A.Ac);break;case 308:f.value.K=Lj(c,e.a.K.K,f.D),lk(c,e.a.K.K,f,e.a.K.Ac)}}else switch(c=a,e.type){case 118:e=X(c,e);ik(c,String(e));break;case 124:e=jj(c,e);ik(c,di(e));break;case 114:e=kj(c,e);ik(c,e?"true":"false");break;case 126:e=Sj(c,e);ik(c,li("(",e));break;case 106:e=
nj(c,e);0==e.head&&ik(c,"set is empty");for(e=e.head;null!=e;e=e.next)ik(c,"   "+li("(",e.D));break;case 110:for(f=void 0,e=Jj(c,e),null==e&&ik(c,"linear form is empty"),f=e;null!=f;f=f.next)null==f.A?ik(c,"   "+f.B):ik(c,"   "+f.B+" "+f.A.A.name+li("[",f.A.ka.D))}return 0}function nk(a,b){null==a.Dg?"\n"==b?(a.ee(a.cd,a.je),a.cd=""):a.cd+=b:a.Dg(b)}function ok(a,b){for(var c=0;c<b.length;c++)nk(a,b[c])}
function pk(a,b){var c,d,e,f,g,k=jj(a,b.xd);null==k.P?d=String(k.U):d=k.P;c=b.list;for(f=0;f<d.length;f++)if("%"==d[f])if(e=f++,"%"==d[f])nk(a,"%");else{if(null==c)break;for(;"-"==d[f]||"+"==d[f]||" "==d[f]||"#"==d[f]||"0"==d[f];)f++;for(;wa(d[f]);)f++;if("."==d[f])for(f++;wa(d[f]);)f++;if("d"==d[f]||"i"==d[f]||"e"==d[f]||"E"==d[f]||"f"==d[f]||"F"==d[f]||"g"==d[f]||"G"==d[f]){switch(c.code.type){case 118:g=X(a,c.code);break;case 124:k=jj(a,c.code);null!=k.P&&U(a,"cannot convert "+di(k)+" to floating-point number");
g=k.U;break;case 114:g=kj(a,c.code)?1:0}"d"==d[f]||"i"==d[f]?(-2147483647<=g&&2147483647>=g||U(a,"cannot convert "+g+" to integer"),ok(a,xa(d.slice(e,f+1),Math.floor(g+.5)|0))):ok(a,xa(d.slice(e,f+1),g))}else if("s"==d[f]){switch(c.code.type){case 118:g=String(X(a,c.code));break;case 114:g=kj(a,c.code)?"T":"F";break;case 124:k=jj(a,c.code),null==k.P?g=String(k.U):g=k.P}ok(a,xa(d.slice(e,f+1),g))}else U(a,"format specifier missing or invalid");c=c.next}else"\\"==d[f]?(f++,"t"==d[f]?nk(a,"\t"):"n"==
d[f]?nk(a,"\n"):"\x00"==d[f]?U(a,"invalid use of escape character \\ in format control string"):nk(a,d[f])):nk(a,d[f]);return 0}function qk(a,b){for(var c=a.lb,d=b.list;null!=d;d=d.next)rk(a,d);a.lb=c;return 0}
function rk(a,b){a.lb=b;switch(b.type){case 103:y("Generating "+b.C.K.name+"...");var c=b.C.K;oj(a,c.domain,c,Mj);break;case 125:switch(b.C.tab.type){case 112:y("Reading "+b.C.tab.name+"...");break;case 119:y("Writing "+b.C.tab.name+"...")}var c=b.C.tab,d,e,f,g;a.Lc=f={};f.id=0;f.link=null;f.df=0;f.a=null;f.Za=0;f.name=null;f.type=null;f.U=null;f.P=null;for(d=c.a;null!=d;d=d.next)f.df++;f.a=Array(1+f.df);for(g=1;g<=f.df;g++)f.a[g]=null;g=0;for(d=c.a;null!=d;d=d.next){g++;var k=jj(a,d.code);null==
k.P?e=String(k.U):e=k.P;f.a[g]=e}switch(c.type){case 112:g=c.C.ua.set;null!=g&&(g.data&&U(a,g.name+" already provided with data"),mi(g.T,null).value.set=ni(a,117,g.aa),g.data=1);for(e=c.C.ua.list;null!=e;e=e.next)e.W.data&&U(a,e.W.name+" already provided with data"),e.W.data=1;for(e=c.C.ua.Ue;null!=e;e=e.next)f.Za++;for(e=c.C.ua.list;null!=e;e=e.next)f.Za++;f.name=Array(1+f.Za);f.type=Array(1+f.Za);f.U=new Float64Array(1+f.Za);f.P=Array(1+f.Za);g=0;for(e=c.C.ua.Ue;null!=e;e=e.next)g++,f.name[g]=e.name,
f.type[g]="?",f.U[g]=0,f.P[g]="";for(e=c.C.ua.list;null!=e;e=e.next)g++,f.name[g]=e.name,f.type[g]="?",f.U[g]=0,f.P[g]="";for(sk(a,"R");;){for(g=1;g<=f.Za;g++)f.type[g]="?";g=a;d=g.Lc;d=d.link.readRecord(d);0<d&&U(g,"error on reading data from table "+g.lb.C.tab.name);if(d)break;for(g=1;g<=f.Za;g++)"?"==f.type[g]&&U(a,"field "+f.name[g]+" missing in input table");d=null;g=0;for(e=c.C.ua.Ue;null!=e;e=e.next)switch(g++,f.type[g]){case "N":d=fi(d,Zh(f.U[g]));break;case "S":d=fi(d,$h(f.P[g]))}null!=c.C.ua.set&&
gi(a,c.C.ua.set.T.head.value.set,ui(d));for(e=c.C.ua.list;null!=e;e=e.next)switch(g++,null!=ki(a,e.W.T,d)&&U(a,e.W.name+li("[",d)+" already defined"),k=mi(e.W.T,ui(d)),e.W.type){case 118:case 113:case 101:"N"!=f.type[g]&&U(a,e.W.name+" requires numeric data");k.value.U=f.U[g];break;case 124:switch(f.type[g]){case "N":k.value.ba=Zh(f.U[g]);break;case "S":k.value.ba=$h(f.P[g])}}}a.Lc=null;break;case 119:for(d=c.C.Nc.list;null!=d;d=d.next)f.Za++;f.name=Array(1+f.Za);f.type=Array(1+f.Za);f.U=new Float64Array(1+
f.Za);f.P=Array(1+f.Za);g=0;for(d=c.C.Nc.list;null!=d;d=d.next)g++,f.name[g]=d.name,f.type[g]="?",f.U[g]=0,f.P[g]="";sk(a,"W");oj(a,c.C.Nc.domain,c,fk);c=a.Lc;c.link.flush(c);a.Lc=null}break;case 102:y("Checking (line "+b.gb+")...");c=b.C.Mg;oj(a,c.domain,c,gk);break;case 104:ik(a,"Display statement at line "+b.gb);c=b.C.Ng;oj(a,c.domain,c,mk);break;case 121:c=b.C.ih;null==c.Ia?a.je=null:(f=jj(a,c.Ia),a.je=null==f.P?f.U:f.P);oj(a,c.domain,c,pk);break;case 109:c=b.C.Pg,oj(a,c.domain,c,qk)}}
function tk(a){var b;for(b=a.uc;null!=b;b=b.next)switch(b.type){case 122:b.C.set.T=ni(a,106,b.C.set.v);break;case 120:switch(b.C.W.type){case 118:case 113:case 101:b.C.W.T=ni(a,118,b.C.W.v);break;case 124:b.C.W.T=ni(a,124,b.C.W.v)}break;case 127:b.C.A.T=ni(a,107,b.C.A.v);break;case 103:b.C.K.T=ni(a,105,b.C.K.v)}}
function uk(a,b,c){a.gb=0;a.Uc=0;a.m="\n";a.b=0;a.Db=0;a.i="";a.value=0;a.Df=201;a.Cf=0;a.Bf="";a.Ef=0;a.Re=0;a.Se=0;a.If=0;a.Hf=0;a.Gf="";a.Jf=0;ja(a.context,0," ",60);a.mc=0;a.af=c;a.$e=b||"input";$g(a);V(a)}function vk(a,b,c){null==c?a.ee=function(a){y(a)}:(a.ee=c,a.eh=b);a.cd=""}function ik(a,b){a.ee(b,a.je)}function wk(a){0<a.cd.length&&(a.ee(a.cd,a.je),a.cd="")}
function U(a,b){var c;switch(a.I){case 1:case 2:c=Error(a.$e+":"+a.gb+": "+b);c.line=a.gb;c.column=a.Uc;for(var d;0<a.mc;)a.mc--,d=a.context[0],ha(a.context,0,a.context,1,59),a.context[59]=d;y("Context: "+a.gb+" > "+(" "==a.context[0]?"":"...")+a.context.join("").trim());break;case 3:d=null==a.lb?0:a.lb.gb;var e=null==a.lb?0:a.lb.Uc;c=Error(d+": "+b);c.line=d;c.column=e}a.I=4;throw c;}
function ah(a,b){switch(a.I){case 1:case 2:y(a.$e+":"+a.gb+": warning: "+b);break;case 3:y(a.Uf+":"+(null==a.lb?0:a.lb.gb)+": warning: "+b)}}
var Ld=exports.mpl_initialize=function(){var a={gb:0,Uc:0,m:0,b:0,Db:0,i:"",value:0,Df:0,Cf:0,Bf:"",Ef:0,Re:0,Se:0,If:0,Hf:0,Gf:"",Jf:0};a.context=Array(60);ja(a.context,0," ",60);a.mc=0;a.oc=0;a.$={};a.uc=null;a.Lf=0;a.ng=0;a.mg=0;a.Ie=0;a.Qb=0;a.lg=null;a.vh="";a.wh="";a.Fd=qg();a.Kf=0;a.lb=null;a.Lc=null;a.h=0;a.n=0;a.o=null;a.g=null;a.af=null;a.$e=null;a.ee=null;a.eh=null;a.Dg=null;a.je=null;a.I=0;a.Uf=null;a.sh="";return a},Nd=exports.mpl_read_model=function(a,b,c,d){function e(){y(a.gb+" line"+
(1==a.gb?"":"s")+" were read");a.af=null;return a.I}0!=a.I&&x("mpl_read_model: invalid call sequence");null==c&&x("mpl_read_model: no input specified");a.I=1;y("Reading model section from "+b+" ...");uk(a,b,c);Sh(a);null==a.uc&&U(a,"empty model section not allowed");a.Uf=a.$e;tk(a);if(eh(a,"data")){if(d)return ah(a,"data section ignored"),e();a.oc=1;V(a);241!=a.b&&U(a,"semicolon missing where expected");V(a);a.I=2;y("Reading data section from "+b+" ...");wi(a)}Ph(a);return e()},Pd=exports.mpl_read_data=
function(a,b,c){1!=a.I&&2!=a.I&&x("mpl_read_data: invalid call sequence");null==c&&x("mpl_read_data: no input specified");a.I=2;y("Reading data section from "+b+" ...");a.oc=1;uk(a,b,c);Qh(a,"data")&&(V(a),241!=a.b&&U(a,"semicolon missing where expected"),V(a));wi(a);Ph(a);y(a.gb+" line"+(1==a.gb?"":"s")+" were read");a.af=null;return a.I},Rd=exports.mpl_generate=function(a,b,c,d){1!=a.I&&2!=a.I&&x("mpl_generate: invalid call sequence");a.I=3;a.te=d;vk(a,b,c);for(b=a.uc;null!=b&&(rk(a,b),123!=a.lb.type);b=
b.next);a.lb=b;wk(a);for(b=a.uc;null!=b;b=b.next)if(127==b.type)for(c=b.C.A,c=c.T.head;null!=c;c=c.next);for(b=a.uc;null!=b;b=b.next)if(103==b.type)for(c=b.C.K,c=c.T.head;null!=c;c=c.next)for(c.value.K.ia=++a.h,d=c.value.K.form;null!=d;d=d.next)d.A.ka.value.A.H=-1;for(b=a.uc;null!=b;b=b.next)if(127==b.type)for(c=b.C.A,c=c.T.head;null!=c;c=c.next)0!=c.value.A.H&&(c.value.A.H=++a.n);a.o=Array(1+a.h);for(d=1;d<=a.h;d++)a.o[d]=null;for(b=a.uc;null!=b;b=b.next)if(103==b.type)for(c=b.C.K,c=c.T.head;null!=
c;c=c.next)d=c.value.K.ia,a.o[d]=c.value.K;for(d=1;d<=a.h;d++);a.g=Array(1+a.n);for(d=1;d<=a.n;d++)a.g[d]=null;for(b=a.uc;null!=b;b=b.next)if(127==b.type)for(c=b.C.A,c=c.T.head;null!=c;c=c.next)d=c.value.A.H,0!=d&&(a.g[d]=c.value.A);for(d=1;d<=a.n;d++);y("Model has been successfully generated");return a.I},Sd=exports.mpl_get_prob_name=function(a){return a.Uf},Td=exports.mpl_get_num_rows=function(a){3!=a.I&&x("mpl_get_num_rows: invalid call sequence");return a.h},be=exports.mpl_get_num_cols=function(a){3!=
a.I&&x("mpl_get_num_cols: invalid call sequence");return a.n},Ud=exports.mpl_get_row_name=function(a,b){3!=a.I&&x("mpl_get_row_name: invalid call sequence");1<=b&&b<=a.h||x("mpl_get_row_name: i = "+b+"; row number out of range");var c=a.o[b].K.name,c=c+li("[",a.o[b].ka.D).slice(0,255);255==c.length&&(c=c.slice(0,252)+"...");return c},ie=exports.mpl_get_row_kind=function(a,b){var c;3!=a.I&&x("mpl_get_row_kind: invalid call sequence");1<=b&&b<=a.h||x("mpl_get_row_kind: i = "+b+"; row number out of range");
switch(a.o[b].K.type){case 103:c=411;break;case 116:c=je;break;case 115:c=ke}return c},Vd=exports.mpl_get_row_bnds=function(a,b,c){var d;3!=a.I&&x("mpl_get_row_bnds: invalid call sequence");1<=b&&b<=a.h||x("mpl_get_row_bnds: i = "+b+"; row number out of range");d=a.o[b];a=null==d.K.S?-t:d.S;b=null==d.K.Z?+t:d.Z;a==-t&&b==+t?(d=Wd,a=b=0):b==+t?(d=Xd,b=0):a==-t?(d=Yd,a=0):d=d.K.S!=d.K.Z?Zd:$d;c(a,b);return d},he=exports.mpl_get_mat_row=function(a,b,c,d){var e=0;3!=a.I&&x("mpl_get_mat_row: invalid call sequence");
1<=b&&b<=a.h||x("mpl_get_mat_row: i = "+b+"; row number out of range");for(a=a.o[b].form;null!=a;a=a.next)e++,null!=c&&(c[e]=a.A.H),null!=d&&(d[e]=a.B);return e},ae=exports.mpl_get_row_c0=function(a,b){var c;3!=a.I&&x("mpl_get_row_c0: invalid call sequence");1<=b&&b<=a.h||x("mpl_get_row_c0: i = "+b+"; row number out of range");c=a.o[b];return null==c.K.S&&null==c.K.Z?-c.S:0},ce=exports.mpl_get_col_name=function(a,b){3!=a.I&&x("mpl_get_col_name: invalid call sequence");1<=b&&b<=a.n||x("mpl_get_col_name: j = "+
b+"; column number out of range");var c=a.g[b].A.name,c=c+li("[",a.g[b].ka.D);255==c.length&&(c=c.slice(0,252)+"...");return c},de=exports.mpl_get_col_kind=function(a,b){var c;3!=a.I&&x("mpl_get_col_kind: invalid call sequence");1<=b&&b<=a.n||x("mpl_get_col_kind: j = "+b+"; column number out of range");switch(a.g[b].A.type){case 118:c=421;break;case 113:c=ee;break;case 101:c=fe}return c},ge=exports.mpl_get_col_bnds=function(a,b,c){var d;3!=a.I&&x("mpl_get_col_bnds: invalid call sequence");1<=b&&b<=
a.n||x("mpl_get_col_bnds: j = "+b+"; column number out of range");d=a.g[b];a=null==d.A.S?-t:d.S;b=null==d.A.Z?+t:d.Z;a==-t&&b==+t?(d=Wd,a=b=0):b==+t?(d=Xd,b=0):a==-t?(d=Yd,a=0):d=d.A.S!=d.A.Z?Zd:$d;c(a,b);return d},me=exports.mpl_has_solve_stmt=function(a){3!=a.I&&x("mpl_has_solve_stmt: invalid call sequence");return a.Qb},ne=exports.mpl_put_row_soln=function(a,b,c,d,e){a.o[b].stat=c;a.o[b].w=d;a.o[b].M=e},oe=exports.mpl_put_col_soln=function(a,b,c,d,e){a.g[b].stat=c;a.g[b].w=d;a.g[b].M=e},pe=exports.mpl_postsolve=
function(a){(3!=a.I||a.Kf)&&x("mpl_postsolve: invalid call sequence");var b;a.Kf=1;for(b=a.lb;null!=b;b=b.next)rk(a,b);a.lb=null;wk(a);y("Model has been successfully processed");return a.I},xk="Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" "),yk="January February March April May June July August September October November December".split(" ");function zk(a){for(var b="";0<a;)b+="^",a--;return b}
function Ak(a,b,c,d,e,f){y("Input string passed to str2time:");y(b);y(zk(c+1));y("Format string passed to str2time:\n");y(d);y(zk(e+1));U(a,f)}
function Pj(a,b,c){function d(){Ak(a,b,p,c,u,"time zone offset value incomplete or invalid")}function e(){Ak(a,b,p,c,u,"time zone offset value out of range")}function f(){b[p]!=c[u]&&Ak(a,b,p,c,u,"character mismatch");p++}var g,k,h,l,n,m,q,r,p,u;k=h=l=n=m=q=-1;r=2147483647;for(u=p=0;u<c.length;u++)if("%"==c[u])if(u++,"b"==c[u]||"h"==c[u]){var v;for(0<=h&&Ak(a,b,p,c,u,"month multiply specified");" "==b[p];)p++;for(h=1;12>=h;h++){v=yk[h-1];var H=!1;for(g=0;2>=g;g++)if(p[g].toUpperCase()!=v[g].toUpperCase()){H=
!0;break}if(!H){p+=3;for(g=3;"\x00"!=v[g]&&b[p].toUpperCase()==v[g].toUpperCase();g++)p++;break}}12<h&&Ak(a,b,p,c,u,"abbreviated month name missing or invalid")}else if("d"==c[u]){for(0<=l&&Ak(a,b,p,c,u,"day multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||Ak(a,b,p,c,u,"day missing or invalid");l=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(l=10*l+(b[p++]-0));1<=l&&31>=l||Ak(a,b,p,c,u,"day out of range")}else if("H"==c[u]){for(0<=n&&Ak(a,b,p,c,u,"hour multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=
b[p]||Ak(a,b,p,c,u,"hour missing or invalid");n=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(n=10*n+(b[p++]-0));0<=n&&23>=n||Ak(a,b,p,c,u,"hour out of range")}else if("m"==c[u]){for(0<=h&&Ak(a,b,p,c,u,"month multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||Ak(a,b,p,c,u,"month missing or invalid");h=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(h=10*h+(b[p++]-0));1<=h&&12>=h||Ak(a,b,p,c,u,"month out of range")}else if("M"==c[u]){for(0<=m&&Ak(a,b,p,c,u,"minute multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||
Ak(a,b,p,c,u,"minute missing or invalid");m=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(m=10*m+(b[p++]-0));0<=m&&59>=m||Ak(a,b,p,c,u,"minute out of range")}else if("S"==c[u]){for(0<=q&&Ak(a,b,p,c,u,"second multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||Ak(a,b,p,c,u,"second missing or invalid");q=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(q=10*q+(b[p++]-0));0<=q&&60>=q||Ak(a,b,p,c,u,"second out of range")}else if("y"==c[u]){for(0<=k&&Ak(a,b,p,c,u,"year multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||
Ak(a,b,p,c,u,"year missing or invalid");k=b[p++]-0;"0"<=b[p]&&"9">=b[p]&&(k=10*k+(b[p++]-0));k+=69<=k?1900:2E3}else if("Y"==c[u]){for(0<=k&&Ak(a,b,p,c,u,"year multiply specified");" "==b[p];)p++;"0"<=b[p]&&"9">=b[p]||Ak(a,b,p,c,u,"year missing or invalid");k=0;for(g=1;4>=g&&"0"<=b[p]&&"9">=b[p];g++)k=10*k+(b[p++]-0);1<=k&&4E3>=k||Ak(a,b,p,c,u,"year out of range")}else if("z"==c[u]){var E;for(2147483647!=r&&Ak(a,b,p,c,u,"time zone offset multiply specified");" "==b[p];)p++;if("Z"==b[p])E=n=m=0,p++;
else{"+"==b[p]?(E=1,p++):"-"==b[p]?(E=-1,p++):Ak(a,b,p,c,u,"time zone offset sign missing");n=0;for(g=1;2>=g;g++)"0"<=b[p]&&"9">=b[p]||d(),n=10*n+(b[p++]-0);23<n&&e();":"==b[p]&&(p++,"0"<=b[p]&&"9">=b[p]||d());m=0;if("0"<=b[p]&&"9">=b[p]){for(g=1;2>=g;g++)"0"<=b[p]&&"9">=b[p]||d(),m=10*m+(b[p++]-0);59<m&&e()}}r=E*(60*n+m)}else"%"==c[u]?f():Ak(a,b,p,c,u,"invalid conversion specifier");else" "!=c[u]&&f();0>k&&(k=1970);0>h&&(h=1);0>l&&(l=1);0>n&&(n=0);0>m&&(m=0);0>q&&(q=0);2147483647==r&&(r=0);g=vg(l,
h,k);return 60*(60*(24*(g-vg(1,1,1970))+n)+m)+q-60*r}function Bk(a,b,c){y("Format string passed to time2str:");y(b);y(zk(c));U(a,"invalid conversion specifier")}function Ck(a){return(a+vg(1,1,1970))%7+1}function Dk(a){a=vg(1,1,a)-vg(1,1,1970);switch(Ck(a)){case 1:a+=0;break;case 2:--a;break;case 3:a-=2;break;case 4:a-=3;break;case 5:a+=3;break;case 6:a+=2;break;case 7:a+=1}Ck(a);return a}
function Qj(a,b,c){var d,e=0,f=0,g=0,k,h,l,n="",m;-62135596800<=b&&64092211199>=b||U(a,"time2str("+b+",...); argument out of range");b=Math.floor(b+.5);k=Math.abs(b)/86400;d=Math.floor(k);0>b&&(d=k==Math.floor(k)?-d:-(d+1));wg(d+vg(1,1,1970),function(a,b,c){g=a;f=b;e=c});h=b-86400*d|0;k=h/60;h%=60;b=k/60;k%=60;for(l=0;l<c.length;l++){if("%"==c[l])if(l++,"a"==c[l])m=xk[Ck(d)-1].slice(0,3);else if("A"==c[l])m=xk[Ck(d)-1];else if("b"==c[l]||"h"==c[l])m=yk[f-1].slice(0,3);else if("B"==c[l])m=yk[f-1];
else if("C"==c[l])m=String(Math.floor(e/100));else if("d"==c[l])m=String(g);else if("D"==c[l])m=f+"/"+g+"/"+e%100;else if("e"==c[l])m=String(g);else if("F"==c[l])xa(m,e+"-"+f+"-"+g);else if("g"==c[l]){var q;d<Dk(e)?q=e-1:q=d<Dk(e+1)?e:e+1;m=String(q%100)}else"G"==c[l]?(d<Dk(e)?q=e-1:q=d<Dk(e+1)?e:e+1,m=String(q)):"H"==c[l]?m=String(b):"I"==c[l]?m=String(0==b?12:12>=b?b:b-12):"j"==c[l]?m=String(vg(g,f,e)-vg(1,1,e)+1):"k"==c[l]?m=String(b):"l"==c[l]?m=String(0==b?12:12>=b?b:b-12):"m"==c[l]?m=String(f):
"M"==c[l]?m=String(k):"p"==c[l]?m=11>=b?"AM":"PM":"P"==c[l]?m=11>=b?"am":"pm":"r"==c[l]?m=(0==b?12:12>=b?b:b-12)+":"+k+":"+h+" "+(11>=b?"AM":"PM"):"R"==c[l]?m=b+":"+k:"S"==c[l]?m=String(h):"T"==c[l]?m=b+":"+k+":"+h:"u"==c[l]?m=String(Ck(d)):"U"==c[l]?(m=vg(1,1,e)-vg(1,1,1970),m+=7-Ck(m),m=String((d+7-m)/7)):"V"==c[l]?(q=d<Dk(e)?d-Dk(e-1):d<Dk(e+1)?d-Dk(e):d-Dk(e+1),m=String(q/7+1)):"w"==c[l]?m=String(Ck(d)%7):"W"==c[l]?(m=vg(1,1,e)-vg(1,1,1970),m+=(8-Ck(m))%7,m=String((d+7-m)/7)):"y"==c[l]?m=String(e%
100):"Y"==c[l]?m=String(e):"%"==c[l]?m="%":Bk(a,c,l);else m=c[l];n+=m}return n}var Ek={};function sk(a,b){var c=a.Lc,d=Ek[c.a[1].toLowerCase()];d?c.link=new d(c,b,a.te):U(a,"Invalid table driver '"+c.a[1]+"'");null==c.link&&U(a,"error on opening table "+a.lb.C.tab.name)}var Fk=exports.mpl_tab_drv_register=function(a,b){Ek[a.toLowerCase()]=b};
function Gk(a,b,c){this.mode=b;this.Ia=null;this.count=0;this.m="\n";this.Jb=0;this.sb="";this.Za=0;this.Ra=[];this.te=c;this.jg=0;this.ye=1;this.kg=2;this.ze=3;2>Wj(a)&&x("csv_driver: file name not specified\n");this.Ia=Xj(a,2);if("R"==b){c?(this.data=c(a.a,b),this.cursor=0):x("csv_driver: unable to open "+this.Ia);this.Ag=0;for(Hk(this);;){Hk(this);if(this.Jb==this.ye)break;this.Jb!=this.ze&&x(this.Ia+":"+this.count+": invalid field name\n");this.Za++;for(b=Yj(a);1<=b&&Zj(a,b)!=this.sb;b--);this.Ra[this.Za]=
b}for(b=Yj(a);1<=b&&"RECNO"!=Zj(a,b);b--);this.Ra[0]=b}else if("W"==b){this.data="";c=Yj(a);for(b=1;b<=c;b++)this.data+=Zj(a,b)+(b<c?",":"\n");this.count++}}
function Hk(a){if(-1==a.m)a.Jb=a.jg,a.sb="EOF";else if("\n"==a.m){if(a.Jb=a.ye,a.sb="EOR",Ik(a),","==a.m&&x(a.Ia+":"+a.count+": empty field not allowed\n"),"\n"==a.m&&x(a.Ia+":"+a.count+": empty record not allowed\n"),"#"==a.m&&1==a.count)for(;"#"==a.m;){for(;"\n"!=a.m;)Ik(a);Ik(a);a.Ag++}}else if(","==a.m&&Ik(a),"'"==a.m||'"'==a.m){var b=a.m;a.sb="";a.Jb=a.ze;for(Ik(a);;){if(a.m==b&&(Ik(a),a.m!=b))if(","==a.m||"\n"==a.m)break;else x(a.Ia+":"+a.count+": invalid field");a.sb+=a.m;Ik(a)}0==a.sb.length&&
x(a.Ia+":"+a.count+": empty field not allowed")}else{a.sb="";for(a.Jb=a.kg;","!=a.m&&"\n"!=a.m;)"'"!=a.m&&'"'!=a.m||x(a.Ia+":"+a.count+": invalid use of single or double quote within field"),a.sb+=a.m,Ik(a);0==a.sb.length&&x(a.Ia+":"+a.count+": empty field not allowed");tg(a.sb,function(){})&&(a.Jb=a.ze)}}function Ik(a){var b;for("\n"==a.m&&a.count++;;)if(a.cursor<a.data.length?b=a.data[a.cursor++]:b=-1,"\r"!=b){"\n"!=b&&ta(b)&&x(a.Ia+":"+a.count+": invalid control character "+b);break}a.m=b}
Gk.prototype.readRecord=function(a){var b;0<this.Ra[0]&&dk(a,this.Ra[0],this.count-this.Ag-1);for(b=1;b<=this.Za;b++){Hk(this);if(this.Jb==this.jg)return-1;if(this.Jb==this.ye){var c=this.Za-b+1;1==c?x(this.Ia+":"+this.count+": one field missing"):x(this.Ia+":"+this.count+": "+c+" fields missing")}else if(this.Jb==this.kg){if(0<this.Ra[b]){var d=0;tg(this.sb,function(a){d=a});dk(a,this.Ra[b],d)}}else this.Jb==this.ze&&0<this.Ra[b]&&ek(a,this.Ra[b],this.sb)}Hk(this);this.Jb!=this.ye&&x(this.Ia+":"+
this.count+": too many fields");return 0};Gk.prototype.writeRecord=function(a){var b,c,d,e;c=Yj(a);for(b=1;b<=c;b++){switch(ak(a,b)){case "N":this.data+=bk(a,b);break;case "S":this.data+='"';d=ck(a,b);for(e=0;d.length>e;e++)'"'==d[e]?this.data+='""':this.data+=d[e];this.data+='"'}this.data+=b<c?",":"\n"}this.count++;return 0};Gk.prototype.flush=function(a){this.te(a.a,this.mode,this.data)};Fk("CSV",Gk);
function Jk(a,b,c){this.mode=b;this.Ia=null;2>Wj(a)&&x("json driver: file name not specified");this.Ia=Xj(a,2);if("R"==b)for(this.Ra={},c?(this.data=c(a.a,b),"string"==typeof this.data&&(this.data=JSON.parse(this.data)),this.cursor=1):x("json driver: unable to open "+this.Ia),a=0,b=this.data[0];a<b.length;a++)this.Ra[b[a]]=a;else if("W"==b){this.te=c;c=[];this.data=[c];var d=Yj(a);for(b=1;b<=d;b++)c.push(Zj(a,b))}}
Jk.prototype.writeRecord=function(a){var b,c=Yj(a),d=[];for(b=1;b<=c;b++)switch(ak(a,b)){case "N":d.push(bk(a,b));break;case "S":d.push(ck(a,b))}this.data.push(d);return 0};Jk.prototype.readRecord=function(a){var b=this.data[this.cursor++];if(null==b)return-1;for(var c=1;c<=Yj(a);c++){var d=this.Ra[Zj(a,c)];if(null!=d)switch(d=b[d],typeof d){case "number":dk(a,c,d);break;case "boolean":dk(a,c,Number(d));break;case "string":ek(a,c,d);break;default:x("Unexpected data type "+d+" in "+this.Ia)}}return 0};
Jk.prototype.flush=function(a){this.te(a.a,this.mode,this.data)};Fk("JSON",Jk);function Yb(){var a={bc:0};a.wc=a.ah=a.bh=0;a.name=a.ib=null;a.la=0;a.ce=a.be=0;a.Fb=a.Oc=null;a.Mb=a.rd=null;a.top=null;a.h=a.n=a.O=0;a.qf=a.Rd=null;a.ha=a.se=0;a.he=a.tg=a.Gg=a.vg=0;a.pa=null;a.Ea=null;a.oa=null;a.Sa=null;return a}function Kk(a,b,c){0==c?(b.ga=null,b.next=a.Fb,null==b.next?a.Oc=b:b.next.ga=b,a.Fb=b):(b.ga=a.Oc,b.next=null,null==b.ga?a.Fb=b:b.ga.next=b,a.Oc=b)}
function Lk(a,b){null==b.ga?a.Fb=b.next:b.ga.next=b.next;null==b.next?a.Oc=b.ga:b.next.ga=b.ga}function Mk(a,b){b.na||(b.na=1,Lk(a,b),Kk(a,b,0))}function Nk(a,b,c){0==c?(b.ga=null,b.next=a.Mb,null==b.next?a.rd=b:b.next.ga=b,a.Mb=b):(b.ga=a.rd,b.next=null,null==b.ga?a.Mb=b:b.ga.next=b,a.rd=b)}function Ok(a,b){null==b.ga?a.Mb=b.next:b.ga.next=b.next;null==b.next?a.rd=b.ga:b.next.ga=b.ga}function Pk(a,b){b.na||(b.na=1,Ok(a,b),Nk(a,b,0))}
function Qk(a){var b={};b.ia=++a.ce;b.name=null;b.c=-t;b.f=+t;b.l=null;b.na=0;Kk(a,b,1);return b}function Rk(a){var b={};b.H=++a.be;b.name=null;b.Ua=0;b.c=b.f=b.B=0;b.l=null;b.na=0;b.tb={};b.wb={};Nk(a,b,1);return b}function Sk(a,b,c){var d={};d.o=a;d.g=b;d.j=c;d.ya=null;d.G=a.l;d.va=null;d.L=b.l;null!=d.G&&(d.G.ya=d);null!=d.L&&(d.L.va=d);a.l=b.l=d}function Tk(a,b){var c;c={};c.Xd=b;c.info={};c.link=a.top;a.top=c;return c.info}
function Uk(a){for(var b;null!=a.l;)b=a.l,a.l=b.G,null==b.va?b.g.l=b.L:b.va.L=b.L,null!=b.L&&(b.L.va=b.va)}function Vk(a,b){Uk(b);Lk(a,b)}function Wk(a,b){for(var c;null!=b.l;)c=b.l,b.l=c.L,null==c.ya?c.o.l=c.G:c.ya.G=c.G,null!=c.G&&(c.G.ya=c.ya);Ok(a,b)}
function Zb(a,b,c){var d=cb,e=cb,f=b.h,g=b.n,k,h,l;a.bc=b.dir;a.bc==za?l=1:a.bc==Ea&&(l=-1);a.wc=f;a.ah=g;a.bh=b.O;d&&null!=b.name&&(a.name=b.name);d&&null!=b.ib&&(a.ib=b.ib);a.la=l*b.la;k=Array(1+f);for(h=1;h<=f;h++){var n=b.o[h],m;k[h]=m=Qk(a);d&&null!=n.name&&(m.name=n.name);if(e){var q=n.qa;n.type==Ka?(m.c=-t,m.f=+t):n.type==Sa?(m.c=n.c*q,m.f=+t):n.type==Ta?(m.c=-t,m.f=n.f*q):n.type==Q?(m.c=n.c*q,m.f=n.f*q):n.type==C&&(m.c=m.f=n.c*q)}else n.type==Ka?(m.c=-t,m.f=+t):n.type==Sa?(m.c=n.c,m.f=+t):
n.type==Ta?(m.c=-t,m.f=n.f):n.type==Q?(m.c=n.c,m.f=n.f):n.type==C&&(m.c=m.f=n.c)}for(f=1;f<=g;f++)if(m=b.g[f],h=Rk(a),d&&null!=m.name&&(h.name=m.name),c==Sc&&(h.Ua=Number(m.kind==Fc)),e)for(n=m.za,m.type==Ka?(h.c=-t,h.f=+t):m.type==Sa?(h.c=m.c/n,h.f=+t):m.type==Ta?(h.c=-t,h.f=m.f/n):m.type==Q?(h.c=m.c/n,h.f=m.f/n):m.type==C&&(h.c=h.f=m.c/n),h.B=l*m.B*n,m=m.l;null!=m;m=m.L)Sk(k[m.o.ia],h,m.o.qa*m.j*n);else for(m.type==Ka?(h.c=-t,h.f=+t):m.type==Sa?(h.c=m.c,h.f=+t):m.type==Ta?(h.c=-t,h.f=m.f):m.type==
Q?(h.c=m.c,h.f=m.f):m.type==C&&(h.c=h.f=m.c),h.B=l*m.B,m=m.l;null!=m;m=m.L)Sk(k[m.o.ia],h,m.j);a.ha=c;a.se=e}
function dc(a,b){var c,d,e,f,g,k,h;db(b);Ca(b,a.name);Da(b,a.ib);Fa(b,a.bc);a.bc==za?k=1:a.bc==Ea&&(k=-1);Xa(b,0,k*a.la);for(c=a.Fb;null!=c;c=c.next)c.na=e=La(b,1),Pa(b,e,c.name),d=c.c==-t&&c.f==+t?Ka:c.f==+t?Sa:c.c==-t?Ta:c.c!=c.f?Q:C,Ua(b,e,d,c.c,c.f);g=new Int32Array(1+b.h);h=new Float64Array(1+b.h);for(c=a.Mb;null!=c;c=c.next){e=Oa(b,1);Qa(b,e,c.name);Hc(b,e,c.Ua?Fc:Ma);d=c.c==-t&&c.f==+t?Ka:c.f==+t?Sa:c.c==-t?Ta:c.c!=c.f?Q:C;Va(b,e,d,c.c,c.f);Xa(b,e,k*c.B);f=0;for(d=c.l;null!=d;d=d.L)f++,g[f]=
d.o.na,h[f]=d.j;Za(b,e,f,g,h)}a.h=b.h;a.n=b.n;a.O=b.O;a.qf=new Int32Array(1+a.h);a.Rd=new Int32Array(1+a.n);c=a.Fb;for(e=0;null!=c;c=c.next)a.qf[++e]=c.ia;c=a.Mb;for(e=0;null!=c;c=c.next)a.Rd[++e]=c.H;a.name=a.ib=null;a.la=0;a.Fb=a.Oc=null;a.Mb=a.rd=null}
function Vb(a,b){var c,d,e,f;a.bc==za?d=1:a.bc==Ea&&(d=-1);a.ha==$b?(a.he=b.ra,a.tg=b.wa):a.ha==le?a.Gg=b.bf:a.ha==Sc&&(a.vg=b.Da);if(a.ha==$b){null==a.pa&&(a.pa=new Int8Array(1+a.ce));for(f=1;f<=a.ce;f++)a.pa[f]=0;null==a.oa&&(a.oa=new Int8Array(1+a.be));for(c=1;c<=a.be;c++)a.oa[c]=0}null==a.Sa&&(a.Sa=new Float64Array(1+a.be));for(c=1;c<=a.be;c++)a.Sa[c]=t;if(a.ha!=Sc)for(null==a.Ea&&(a.Ea=new Float64Array(1+a.ce)),f=1;f<=a.ce;f++)a.Ea[f]=t;if(a.ha==$b){for(f=1;f<=a.h;f++)c=b.o[f],e=a.qf[f],a.pa[e]=
c.stat,a.Ea[e]=d*c.M;for(c=1;c<=a.n;c++)d=b.g[c],e=a.Rd[c],a.oa[e]=d.stat,a.Sa[e]=d.w}else if(a.ha==le){for(f=1;f<=a.h;f++)c=b.o[f],e=a.qf[f],a.Ea[e]=d*c.nc;for(c=1;c<=a.n;c++)d=b.g[c],e=a.Rd[c],a.Sa[e]=d.Tb}else if(a.ha==Sc)for(c=1;c<=a.n;c++)d=b.g[c],e=a.Rd[c],a.Sa[e]=d.Va;for(e=a.top;null!=e;e=e.link)e.Xd(a,e.info)}
function Wb(a,b){var c,d,e,f;a.bc==za?e=1:a.bc==Ea&&(e=-1);if(a.ha==$b){b.valid=0;b.ra=a.he;b.wa=a.tg;b.ea=b.la;b.some=0;for(d=1;d<=b.h;d++)c=b.o[d],c.stat=a.pa[d],c.M=a.se?e*a.Ea[d]*c.qa:e*a.Ea[d],c.stat==A?c.M=0:c.stat==M?c.w=c.c:c.stat==P?c.w=c.f:c.stat==Ra?c.w=0:c.stat==Na&&(c.w=c.c);for(d=1;d<=b.n;d++)c=b.g[d],c.stat=a.oa[d],a.se?c.w=a.Sa[d]*c.za:c.w=a.Sa[d],c.stat==A?c.M=0:c.stat==M?c.w=c.c:c.stat==P?c.w=c.f:c.stat==Ra?c.w=0:c.stat==Na&&(c.w=c.c),b.ea+=c.B*c.w;for(d=1;d<=b.h;d++)if(c=b.o[d],
c.stat==A){f=0;for(e=c.l;null!=e;e=e.G)f+=e.j*e.g.w;c.w=f}for(d=1;d<=b.n;d++)if(c=b.g[d],c.stat!=A){f=c.B;for(e=c.l;null!=e;e=e.L)f-=e.j*e.o.M;c.M=f}}else if(a.ha==le){b.bf=a.Gg;b.Zd=b.la;for(d=1;d<=b.h;d++)c=b.o[d],c.nc=a.se?e*a.Ea[d]*c.qa:e*a.Ea[d];for(d=1;d<=b.n;d++)c=b.g[d],a.se?c.Tb=a.Sa[d]*c.za:c.Tb=a.Sa[d],b.Zd+=c.B*c.Tb;for(d=1;d<=b.h;d++){c=b.o[d];f=0;for(e=c.l;null!=e;e=e.G)f+=e.j*e.g.Tb;c.Tb=f}for(d=1;d<=b.n;d++){c=b.g[d];f=c.B;for(e=c.l;null!=e;e=e.L)f-=e.j*e.o.nc;c.nc=f}}else if(a.ha==
Sc){b.Da=a.vg;b.xa=b.la;for(d=1;d<=b.n;d++)c=b.g[d],c.Va=a.Sa[d],b.xa+=c.B*c.Va;for(d=1;d<=b.h;d++){c=b.o[d];f=0;for(e=c.l;null!=e;e=e.G)f+=e.j*e.g.Va;c.Va=f}}}function Xk(a,b){Tk(a,function(a,b){a.ha==$b&&(a.pa[b.p]=A);a.ha!=Sc&&(a.Ea[b.p]=0);return 0}).p=b.ia;Vk(a,b)}
function Yk(a,b){var c,d;c=Tk(a,function(a,b){if(a.ha==$b)if(a.oa[b.q]==A||a.oa[b.q]==M||a.oa[b.q]==P)a.oa[b.q]=a.oa[b.q];else return 1;a.Sa[b.q]=b.Ig+a.Sa[b.q];return 0});c.q=b.H;c.Ig=b.c;a.la+=b.B*b.c;for(d=b.l;null!=d;d=d.L)c=d.o,c.c==c.f?c.f=c.c-=d.j*b.c:(c.c!=-t&&(c.c-=d.j*b.c),c.f!=+t&&(c.f-=d.j*b.c));b.f!=+t&&(b.f-=b.c);b.c=0}
function Zk(a,b){var c,d;c=Tk(a,function(a,b){a.ha==$b&&(a.oa[b.q]=Na);a.Sa[b.q]=b.kh;return 0});c.q=b.H;c.kh=b.c;a.la+=b.B*b.c;for(d=b.l;null!=d;d=d.L)c=d.o,c.c==c.f?c.f=c.c-=d.j*b.c:(c.c!=-t&&(c.c-=d.j*b.c),c.f!=+t&&(c.f-=d.j*b.c));Wk(a,b)}
function $k(a,b){var c,d,e;d=1E-9+1E-12*Math.abs(b.c);b.f-b.c>d||(Tk(a,function(a,b){if(a.ha==$b)if(a.pa[b.p]==A)a.pa[b.p]=A;else if(a.pa[b.p]==Na)a.pa[b.p]=0<=a.Ea[b.p]?M:P;else return 1;return 0}).p=b.ia,c=.5*(b.f+b.c),e=Math.floor(c+.5),Math.abs(c-e)<=d&&(c=e),b.c=b.f=c)}
function al(a,b){var c,d,e,f;f=1E-9+1E-12*Math.abs(b.c);if(b.f-b.c>f)return 0;c=Tk(a,function(a,b){var c,d;if(a.ha==$b)if(a.oa[b.q]==A)a.oa[b.q]=A;else if(a.oa[b.q]==Na){d=b.m;for(c=b.l;null!=c;c=c.next)d-=c.j*a.Ea[c.Ra];a.oa[b.q]=0<=d?M:P}else return 1;return 0});c.q=b.H;c.m=b.B;c.l=null;if(a.ha==$b)for(d=b.l;null!=d;d=d.L)e={},e.Ra=d.o.ia,e.j=d.j,e.next=c.l,c.l=e;c=.5*(b.f+b.c);d=Math.floor(c+.5);Math.abs(c-d)<=f&&(c=d);b.c=b.f=c;return 1}
function bl(a,b){if(.001<b.c||-.001>b.f)return 1;b.c=-t;b.f=+t;Xk(a,b);return 0}function cl(a,b){function c(){e.stat=M;b.f=b.c}function d(){e.stat=P;b.c=b.f}var e;if(.001<b.B&&b.c==-t||-.001>b.B&&b.f==+t)return 1;e=Tk(a,function(a,b){a.ha==$b&&(a.oa[b.q]=b.stat);return 0});e.q=b.H;b.c==-t&&b.f==+t?(e.stat=Ra,b.c=b.f=0):b.f==+t?c():b.c==-t?d():b.c!=b.f?2.220446049250313E-16<=b.B?c():-2.220446049250313E-16>=b.B?d():Math.abs(b.c)<=Math.abs(b.f)?c():d():e.stat=Na;Zk(a,b);return 0}
function dl(a,b){var c;if(a.Ua)if(c=Math.floor(b+.5),1E-5>=Math.abs(b-c))b=c;else return 2;if(a.c!=-t){c=a.Ua?1E-5:1E-5+1E-8*Math.abs(a.c);if(b<a.c-c)return 1;if(b<a.c+.001*c)return a.f=a.c,0}if(a.f!=+t){c=a.Ua?1E-5:1E-5+1E-8*Math.abs(a.f);if(b>a.f+c)return 1;if(b>a.f-.001*c)return a.c=a.f,0}a.c=a.f=b;return 0}
function el(a,b){var c,d,e;e=b.l;d=e.g;c=dl(d,b.c/e.j);if(0!=c)return c;c=Tk(a,function(a,b){var c,d;if(a.ha==$b){if(a.oa[b.q]!=Na)return 1;a.pa[b.p]=Na;a.oa[b.q]=A}if(a.ha!=Sc){d=b.m;for(c=b.l;null!=c;c=c.next)d-=c.j*a.Ea[c.Ra];a.Ea[b.p]=d/b.Ha}return 0});c.p=b.ia;c.q=d.H;c.Ha=e.j;c.m=d.B;c.l=null;if(a.ha!=Sc)for(e=d.l;null!=e;e=e.L)e.o!=b&&(d={},d.Ra=e.o.ia,d.j=e.j,d.next=c.l,c.l=d);Vk(a,b);return 0}
function fl(a,b){var c;a.Ua&&(c=Math.floor(b+.5),b=1E-5>=Math.abs(b-c)?c:Math.ceil(b));if(a.c!=-t&&(c=a.Ua?.001:.001+1E-6*Math.abs(a.c),b<a.c+c))return 0;if(a.f!=+t){c=a.Ua?1E-5:1E-5+1E-8*Math.abs(a.f);if(b>a.f+c)return 4;if(b>a.f-.001*c)return a.c=a.f,3}c=a.c==-t?2:a.Ua&&b>a.c+.5?2:b>a.c+.3*(1+Math.abs(a.c))?2:1;a.c=b;return c}
function gl(a,b){var c;a.Ua&&(c=Math.floor(b+.5),b=1E-5>=Math.abs(b-c)?c:Math.floor(b));if(a.f!=+t&&(c=a.Ua?.001:.001+1E-6*Math.abs(a.f),b>a.f-c))return 0;if(a.c!=-t){c=a.Ua?1E-5:1E-5+1E-8*Math.abs(a.c);if(b<a.c-c)return 4;if(b<a.c+.001*c)return a.f=a.c,3}c=a.f==+t?2:a.Ua&&b<a.f-.5?2:b<a.f-.3*(1+Math.abs(a.f))?2:1;a.f=b;return c}
function hl(a,b){var c,d,e,f,g,k;e=b.l;d=e.g;0<e.j?(g=b.c==-t?-t:b.c/e.j,c=b.f==+t?+t:b.f/e.j):(g=b.f==+t?-t:b.f/e.j,c=b.c==-t?+t:b.c/e.j);if(g==-t)g=0;else if(g=fl(d,g),4==g)return 4;if(c==+t)k=0;else if(3==g)k=0;else if(k=gl(d,c),4==k)return 4;if(!g&&!k)return b.c=-t,b.f=+t,Xk(a,b),0;c=Tk(a,function(a,b){var c,d;if(a.ha==Sc)return 0;d=b.m;for(c=b.l;null!=c;c=c.next)d-=c.j*a.Ea[c.Ra];if(a.ha==$b){c=function(){b.cg?(a.pa[b.p]=0<b.Ha?P:M,a.oa[b.q]=A,a.Ea[b.p]=d/b.Ha):(a.pa[b.p]=A,a.Ea[b.p]=0);return 0};
var e=function(){b.Rf?(a.pa[b.p]=0<b.Ha?M:P,a.oa[b.q]=A,a.Ea[b.p]=d/b.Ha):(a.pa[b.p]=A,a.Ea[b.p]=0);return 0};if(a.oa[b.q]==A)a.pa[b.p]=A,a.Ea[b.p]=0;else if(a.oa[b.q]==M)e();else if(a.oa[b.q]==P)c();else if(a.oa[b.q]==Na){if(1E-7<d&&(0<b.Ha&&b.c!=-t||0>b.Ha&&b.f!=+t||!b.Rf))return a.oa[b.q]=M,e();if(-1E-7>d&&(0<b.Ha&&b.f!=+t||0>b.Ha&&b.c!=-t||!b.cg))return a.oa[b.q]=P,c();if(b.c!=-t&&b.f==+t)a.pa[b.p]=M;else if(b.c==-t&&b.f!=+t)a.pa[b.p]=P;else if(b.c!=-t&&b.f!=+t)a.pa[b.p]=b.Ha*a.Sa[b.q]<=.5*(b.c+
b.f)?M:P;else return 1;a.oa[b.q]=A;a.Ea[b.p]=d/b.Ha}else return 1}a.ha==le&&(a.Ea[b.p]=2.220446049250313E-16<d&&b.Rf||-2.220446049250313E-16>d&&b.cg?d/b.Ha:0);return 0});c.p=b.ia;c.q=d.H;c.Ha=e.j;c.m=d.B;c.c=b.c;c.f=b.f;c.Rf=g;c.cg=k;c.l=null;if(a.ha!=Sc)for(d=d.l;null!=d;d=d.L)d!=e&&(f={},f.Ra=d.o.ia,f.j=d.j,f.next=c.l,c.l=f);Vk(a,b);return g>=k?g:k}
function il(a,b){var c,d,e,f;e=b.l;d=e.o;c=Tk(a,function(a,b){var c,d;if(a.ha==$b){if(a.pa[b.p]==A||a.pa[b.p]==Ra)a.oa[b.q]=a.pa[b.p];else if(a.pa[b.p]==M)a.oa[b.q]=0<b.Ha?P:M;else if(a.pa[b.p]==P)a.oa[b.q]=0<b.Ha?M:P;else return 1;a.pa[b.p]=Na}a.ha!=Sc&&(a.Ea[b.p]+=b.m/b.Ha);c=b.od;for(d=b.l;null!=d;d=d.next)c-=d.j*a.Sa[d.Ra];a.Sa[b.q]=c/b.Ha;return 0});c.p=d.ia;c.q=b.H;c.Ha=e.j;c.od=d.c;c.m=b.B;c.l=null;for(e=d.l;null!=e;e=e.G)e.g!=b&&(f={},f.Ra=e.g.H,f.j=e.j,f.next=c.l,c.l=f,e.g.B-=e.j/c.Ha*c.m);
a.la+=c.od/c.Ha*c.m;0<c.Ha?(d.c=b.f==+t?-t:c.od-c.Ha*b.f,d.f=b.c==-t?+t:c.od-c.Ha*b.c):(d.c=b.c==-t?-t:c.od-c.Ha*b.c,d.f=b.f==+t?+t:c.od-c.Ha*b.f);Wk(a,b)}
function jl(a,b){function c(){e.stat=M;f.f=f.c}function d(){e.stat=P;f.c=f.f}var e,f,g,k,h,l;g=b.l;f=g.o;h=f.c;if(h!=-t)for(k=f.l;null!=k;k=k.G)if(k!=g)if(0<k.j){if(k.g.f==+t){h=-t;break}h-=k.j*k.g.f}else{if(k.g.c==-t){h=-t;break}h-=k.j*k.g.c}l=f.f;if(l!=+t)for(k=f.l;null!=k;k=k.G)if(k!=g)if(0<k.j){if(k.g.c==-t){l=+t;break}l-=k.j*k.g.c}else{if(k.g.f==+t){l=+t;break}l-=k.j*k.g.f}k=0<g.j?h==-t?-t:h/g.j:l==+t?-t:l/g.j;h=0<g.j?l==+t?+t:l/g.j:h==-t?+t:h/g.j;if(b.c!=-t&&(l=1E-9+1E-12*Math.abs(b.c),k<b.c-
l)||b.f!=+t&&(l=1E-9+1E-12*Math.abs(b.f),h>b.f+l))return 1;b.c=-t;b.f=+t;e=Tk(a,function(a,b){if(a.ha==$b)if(a.pa[b.p]==A)a.pa[b.p]=A;else if(a.pa[b.p]==Na)a.pa[b.p]=b.stat;else return 1;return 0});e.p=f.ia;e.stat=-1;g=b.B/g.j;if(2.220446049250313E-16<g)if(f.c!=-t)c();else{if(1E-5<g)return 2;d()}else if(-2.220446049250313E-16>g)if(f.f!=+t)d();else{if(-1E-5>g)return 2;c()}else f.f==+t?c():f.c==-t?d():Math.abs(f.c)<=Math.abs(f.f)?c():d();return 0}
function kl(a,b,c){var d,e=null,f,g,k;d=1;for(g=b.l;null!=g;g=g.G)d<Math.abs(g.j)&&(d=Math.abs(g.j));for(g=b.l;null!=g;g=g.G)if(Math.abs(g.j)<1E-7*d)return 1;d=Tk(a,function(a,b){var c,d,e,f,g;if(a.ha==Sc)return 0;if(a.ha==$b){if(a.pa[b.p]!=A)return 1;for(c=b.l;null!=c;c=c.next){if(a.oa[c.H]!=Na)return 1;a.oa[c.H]=c.stat}}for(c=b.l;null!=c;c=c.next){e=c.m;for(d=c.l;null!=d;d=d.next)e-=d.j*a.Ea[d.Ra];c.m=e}d=null;f=0;for(c=b.l;null!=c;c=c.next)if(e=c.m,g=Math.abs(e/c.Jc),c.stat==M)0>e&&f<g&&(d=c,f=
g);else if(c.stat==P)0<e&&f<g&&(d=c,f=g);else return 1;null!=d&&(a.ha==$b&&(a.pa[b.p]=b.stat,a.oa[d.H]=A),a.Ea[b.p]=d.m/d.Jc);return 0});d.p=b.ia;d.stat=b.c==b.f?Na:0==c?M:P;d.l=null;for(g=b.l;null!=g;g=g.G)if(f=g.g,a.ha!=Sc&&(e={},e.H=f.H,e.stat=-1,e.Jc=g.j,e.m=f.B,e.l=null,e.next=d.l,d.l=e),0==c&&0>g.j||0!=c&&0<g.j?(a.ha!=Sc&&(e.stat=M),f.f=f.c):(a.ha!=Sc&&(e.stat=P),f.c=f.f),a.ha!=Sc)for(f=f.l;null!=f;f=f.L)f!=g&&(k={},k.Ra=f.o.ia,k.j=f.j,k.next=e.l,e.l=k);b.c=-t;b.f=+t;return 0}
function ll(a){var b,c=0,d,e;d=0;for(b=a.l;null!=b;b=b.G)if(0<b.j){if(b.g.c==-t){d=-t;break}d+=b.j*b.g.c}else{if(b.g.f==+t){d=-t;break}d+=b.j*b.g.f}e=0;for(b=a.l;null!=b;b=b.G)if(0<b.j){if(b.g.f==+t){e=+t;break}e+=b.j*b.g.f}else{if(b.g.c==-t){e=+t;break}e+=b.j*b.g.c}if(a.c!=-t&&(b=.001+1E-6*Math.abs(a.c),a.c-b>e)||a.f!=+t&&(b=.001+1E-6*Math.abs(a.f),a.f+b<d))return 51;a.c!=-t&&(b=1E-9+1E-12*Math.abs(a.c),a.c-b>d&&(c=a.c+b<=e?c|1:c|2));a.f!=+t&&(b=1E-9+1E-12*Math.abs(a.f),a.f+b<e&&(c=a.f-b>=d?c|16:
c|32));return c}function ml(a,b,c){a.ha==$b&&(a=Tk(a,function(a,b){if(a.ha!=$b)return 1;a.pa[b.p]=a.pa[b.p]==A?A:b.stat;return 0}),a.p=b.ia,a.stat=b.f==+t?M:b.c==-t?P:b.c!=b.f?0==c?P:M:Na);0==c?b.c=-t:1==c&&(b.f=+t)}
function nl(a){var b,c,d,e,f,g,k,h,l,n,m;h=l=n=m=0;for(d=a.rd;null!=d;d=d.ga)if(d.Ua&&d.c!=d.f&&(0!=d.c||1!=d.f))if(-1E6>d.c||1E6<d.f||4095<d.f-d.c)h++;else if(l++,0!=d.c&&Yk(a,d),e=d.f|0,1!=e){g=2;for(c=4;e>=c;)g++,c+=c;n+=g;b=Tk(a,function(a,b){var c,d,e=a.Sa[b.q];c=1;for(d=2;c<b.n;c++,d+=d)e+=d*a.Sa[b.H+(c-1)];a.Sa[b.q]=e;return 0});b.q=d.H;b.H=0;b.n=g;e<c-1?(c=Qk(a),m++,c.c=-t,c.f=e):c=null;d.f=1;null!=c&&Sk(c,d,1);k=1;for(c=2;k<g;k++,c+=c)for(e=Rk(a),e.Ua=1,e.c=0,e.f=1,e.B=c*d.B,0==b.H&&(b.H=
e.H),f=d.l;null!=f;f=f.L)Sk(f.o,e,c*f.j)}0<l&&y(l+" integer variable(s) were replaced by "+n+" binary ones");0<m&&y(m+" row(s) were added due to binarization");0<h&&y("Binarization failed for "+h+" integer variable(s)")}function ol(a,b){var c,d,e;d=null;for(c=a.l;null!=c;c=c.G)e={},e.ja=b*c.j,e.kc=c.g,e.next=d,d=e;return d}
function pl(a,b,c){var d,e,f;for(d=a;null!=d;d=d.next);e=0;for(d=a;null!=d;d=d.next)if(1!=d.ja)if(-1==d.ja)e++;else break;if(null==d&&b==1-e)return 1;for(d=a;null!=d;d=d.next)0>d.ja&&(b-=d.ja);for(d=a;null!=d;d=d.next)if(Math.abs(d.ja)>b)return 0;e=null;for(d=a;null!=d;d=d.next)if(null==e||Math.abs(e.ja)>Math.abs(d.ja))e=d;f=null;for(d=a;null!=d;d=d.next)d!=e&&(null==f||Math.abs(f.ja)>Math.abs(d.ja))&&(f=d);if(Math.abs(e.ja)+Math.abs(f.ja)<=b+(.001+1E-6*Math.abs(b)))return 0;b=1;for(d=a;null!=d;d=
d.next)0<d.ja?d.ja=1:(d.ja=-1,--b);c(b);return 2}function ql(a,b){var c,d,e,f,g=0,k;for(f=0;1>=f;f++){if(0==f){if(b.f==+t)continue;e=ol(b,1);k=+b.f}else{if(b.c==-t)continue;e=ol(b,-1);k=-b.c}c=pl(e,k,function(a){k=a});if(1==f&&1==c||2==c){g++;if(b.c==-t||b.f==+t)c=null;else for(c=Qk(a),0==f?(c.c=b.c,c.f=+t):(c.c=-t,c.f=b.f),d=b.l;null!=d;d=d.G)Sk(c,d.g,d.j);Uk(b);b.c=-t;for(b.f=k;null!=e;e=e.next)Sk(b,e.kc,e.ja);null!=c&&(b=c)}}return g}
function rl(a,b,c){var d,e;for(d=a;null!=d;d=d.next);e=0;for(d=a;null!=d;d=d.next)if(1!=d.ja)if(-1==d.ja)e++;else break;if(null==d&&b==1-e)return 1;for(d=a;null!=d;d=d.next)0>d.ja&&(b-=d.ja);if(.001>b)return 0;e=1E-9+1E-12*Math.abs(b);for(d=a;null!=d;d=d.next)if(Math.abs(d.ja)<b-e)return 0;b=1;for(d=a;null!=d;d=d.next)0<d.ja?d.ja=1:(d.ja=-1,--b);c(b);return 2}
function sl(a,b){var c,d,e,f,g=0,k;for(f=0;1>=f;f++){if(0==f){if(b.c==-t)continue;e=ol(b,1);k=+b.c}else{if(b.f==+t)continue;e=ol(b,-1);k=-b.f}c=rl(e,k,function(a){k=a});if(1==f&&1==c||2==c){g++;if(b.c==-t||b.f==+t)c=null;else for(c=Qk(a),0==f?(c.c=-t,c.f=b.f):(c.c=b.c,c.f=+t),d=b.l;null!=d;d=d.G)Sk(c,d.g,d.j);Uk(b);b.c=k;for(b.f=+t;null!=e;e=e.next)Sk(b,e.kc,e.ja);null!=c&&(b=c)}}return g}
function tl(a,b,c){var d,e=0,f,g;f=0;for(d=a;null!=d;d=d.next)if(0<d.ja){if(d.kc.c==-t)return e;f+=d.ja*d.kc.c}else{if(d.kc.f==+t)return e;f+=d.ja*d.kc.f}for(d=a;null!=d;d=d.next)d.kc.Ua&&0==d.kc.c&&1==d.kc.f&&(0<d.ja?(a=f,b-d.ja<a&&a<b&&(g=b-a,.001<=g&&d.ja-g>=.01*(1+d.ja)&&(d.ja=g,e++))):(a=f-d.ja,b<a&&a<b-d.ja&&(g=d.ja+(a-b),-.001>=g&&g-d.ja>=.01*(1-d.ja)&&(d.ja=g,f+=a-b,b=a,e++))));c(b);return e}
function ul(a,b){var c,d,e,f,g=Array(2),k;for(f=g[0]=g[1]=0;1>=f;f++){if(0==f){if(b.c==-t)continue;e=ol(b,1);k=+b.c}else{if(b.f==+t)continue;e=ol(b,-1);k=-b.f}g[f]=tl(e,k,function(a){k=a});if(0<g[f]){if(b.c==-t||b.f==+t)c=null;else for(c=Qk(a),0==f?(c.c=-t,c.f=b.f):(c.c=b.c,c.f=+t),d=b.l;null!=d;d=d.G)Sk(c,d.g,d.j);Uk(b);b.c=k;b.f=+t;for(d=e;null!=d;d=d.next)Sk(b,d.kc,d.ja);null!=c&&(b=c)}}return g[0]+g[1]}
function vl(a,b,c){function d(){for(f=b.l;null!=f;f=g){e=f.g;g=f.G;for(k=e.l;null!=k;k=k.L)Mk(a,k.o);Zk(a,e)}Xk(a,b);return 0}var e,f,g,k,h;if(null==b.l){h=bl(a,b);if(0==h)return 0;if(1==h)return bc}if(null==b.l.G)if(e=b.l.g,b.c==b.f){h=el(a,b);if(0==h){for(f=e.l;null!=f;f=f.L)Mk(a,f.o);Zk(a,e);return 0}if(1==h||2==h)return bc}else{h=hl(a,b);if(0<=h&&3>=h){Pk(a,e);if(2<=h)for(f=e.l;null!=f;f=f.L)Mk(a,f.o);3==h&&Zk(a,e);return 0}if(4==h)return bc}h=ll(b);if(51==h)return bc;if(0==(h&15))b.c!=-t&&ml(a,
b,0);else if(1!=(h&15)&&2==(h&15)&&0==kl(a,b,0))return d();if(0==(h&240))b.f!=+t&&ml(a,b,1);else if(16!=(h&240)&&32==(h&240)&&0==kl(a,b,1))return d();if(b.c==-t&&b.f==+t){for(f=b.l;null!=f;f=f.G)Pk(a,f.g);Xk(a,b);return 0}return a.ha==Sc&&c&&0>wl(a,b,1)?bc:0}
function wl(a,b,c){var d,e,f,g,k,h=0,l;k=!1;e=1;for(d=b.l;null!=d;d=d.G)d.g.tb.tb=-t,d.g.wb.wb=+t,e<Math.abs(d.j)&&(e=Math.abs(d.j));g=1E-6*e;if(b.c!=-t){e=null;for(d=b.l;null!=d;d=d.G)if(0<d.j&&d.g.f==+t||0>d.j&&d.g.c==-t)if(null==e)e=d;else{k=!0;break}if(!k){k=b.c;for(d=b.l;null!=d;d=d.G)d!=e&&(k=0<d.j?k-d.j*d.g.f:k-d.j*d.g.c);if(null==e)for(d=b.l;null!=d;d=d.G)d.j>=+g?d.g.tb.tb=d.g.f+k/d.j:d.j<=-g&&(d.g.wb.wb=d.g.c+k/d.j);else e.j>=+g?e.g.tb.tb=k/e.j:e.j<=-g&&(e.g.wb.wb=k/e.j)}}k=!1;if(b.f!=+t){e=
null;for(d=b.l;null!=d;d=d.G)if(0<d.j&&d.g.c==-t||0>d.j&&d.g.f==+t)if(null==e)e=d;else{k=!0;break}if(!k){k=b.f;for(d=b.l;null!=d;d=d.G)d!=e&&(k=0<d.j?k-d.j*d.g.c:k-d.j*d.g.f);if(null==e)for(d=b.l;null!=d;d=d.G)d.j>=+g?d.g.wb.wb=d.g.c+k/d.j:d.j<=-g&&(d.g.tb.tb=d.g.f+k/d.j);else e.j>=+g?e.g.wb.wb=k/e.j:e.j<=-g&&(e.g.tb.tb=k/e.j)}}for(e=b.l;null!=e;)for(d=e.g,e=e.G,g=0;1>=g;g++){f=d.c;l=d.f;if(0==g){if(d.tb.tb==-t)continue;k=fl(d,d.tb.tb)}else{if(d.wb.wb==+t)continue;k=gl(d,d.wb.wb)}if(0==k||1==k)d.c=
f,d.f=l;else if(2==k||3==k){h++;if(c)for(f=d.l;null!=f;f=f.L)f.o!=b&&Mk(a,f.o);if(3==k){Zk(a,d);break}}else if(4==k)return-1}return h}function xl(a,b){var c,d,e;if(null==b.l){e=cl(a,b);if(0==e)return 0;if(1==e)return cc}if(null==b.l.L){var f=function(){il(a,b);if(c.c==-t&&c.f==+t){for(d=c.l;null!=d;d=d.G)Pk(a,d.g);Xk(a,c)}else Mk(a,c);return 0};c=b.l.o;if(c.c==c.f){if(!b.Ua)return f()}else if(!b.Ua){e=jl(a,b);if(0==e)return f();if(1!=e&&2==e)return cc}}return 0}
function ac(a,b){var c,d,e;for(c=a.Fb;null!=c;c=d)d=c.next,c.c==-t&&c.f==+t&&Xk(a,c);for(c=a.Fb;null!=c;c=d)d=c.next,c.c!=-t&&c.f!=+t&&c.c<c.f&&$k(a,c);for(c=a.Mb;null!=c;c=d)d=c.next,c.c==c.f&&Zk(a,c);for(c=a.Mb;null!=c;c=d)d=c.next,c.c!=-t&&c.f!=+t&&c.c<c.f&&(e=al(a,c),0!=e&&1==e&&Zk(a,c));for(c=a.Fb;null!=c;c=c.next)c.na=1;for(c=a.Mb;null!=c;c=c.next)c.na=1;for(d=1;d;){for(d=0;;){c=a.Fb;if(null==c||!c.na)break;d=a;e=c;e.na&&(e.na=0,Lk(d,e),Kk(d,e,1));c=vl(a,c,b);if(0!=c)return c;d=1}for(;;){c=
a.Mb;if(null==c||!c.na)break;d=a;e=c;e.na&&(e.na=0,Ok(d,e),Nk(d,e,1));c=xl(a,c);if(0!=c)return c;d=1}}if(a.ha==Sc&&!b)for(c=a.Fb;null!=c;c=c.next)if(0>wl(a,c,0))return c=bc;return 0}
function Tc(a,b){var c,d,e,f,g;c=ac(a,1);if(0!=c)return c;b.qd&&nl(a);g=0;for(c=a.Oc;null!=c;c=d)if(d=c.ga,(c.c!=-t||c.f!=+t)&&c.c!=c.f&&null!=c.l&&null!=c.l.G){for(f=c.l;null!=f&&(e=f.g,e.Ua&&0==e.c&&1==e.f);f=f.G);null==f&&(g+=ql(a,c))}0<g&&y(g+" hidden packing inequaliti(es) were detected");g=0;for(c=a.Oc;null!=c;c=d)if(d=c.ga,(c.c!=-t||c.f!=+t)&&c.c!=c.f&&null!=c.l&&null!=c.l.G&&null!=c.l.G.G){for(f=c.l;null!=f&&(e=f.g,e.Ua&&0==e.c&&1==e.f);f=f.G);null==f&&(g+=sl(a,c))}0<g&&y(g+" hidden covering inequaliti(es) were detected");
g=0;for(c=a.Oc;null!=c;c=d)d=c.ga,c.c!=c.f&&(g+=ul(a,c));0<g&&y(g+" constraint coefficient(s) were reduced");return 0}function yl(a){var b,c;b=1;for(c=32;55>=c;b++,c++)a.qb[b]=a.qb[b]-a.qb[c]&2147483647;for(c=1;55>=b;b++,c++)a.qb[b]=a.qb[b]-a.qb[c]&2147483647;a.Mf=54;return a.qb[55]}function qg(){var a={},b;a.qb=Array(56);a.qb[0]=-1;for(b=1;55>=b;b++)a.qb[b]=0;a.Mf=0;Md(a,1);return a}
function Md(a,b){var c,d,e=1;b=d=b-0&2147483647;a.qb[55]=d;for(c=21;c;c=(c+21)%55)a.qb[c]=e,e=d-e&2147483647,b&1?b=1073741824+(b>>1):b>>=1,e=e-b&2147483647,d=a.qb[c];yl(a);yl(a);yl(a);yl(a);yl(a)}function Qi(a){return 0<=a.qb[a.Mf]?a.qb[a.Mf--]:yl(a)}function Oj(a){var b;do b=Qi(a);while(2147483648<=b);return b%16777216}function rg(a){a=Qi(a)/2147483647;return-.3*(1-a)+.7*a}var De=1,Fe=2,Ve=1,Re=2,Ce=0,Te=1E-10;function Se(a,b,c){return(b-1)*a.N+c-b*(b-1)/2}
function zl(a,b,c){var d;0==b?(b=1,d=0):Math.abs(a)<=Math.abs(b)?(a=-a/b,d=1/Math.sqrt(1+a*a),b=d*a):(a=-b/a,b=1/Math.sqrt(1+a*a),d=b*a);c(b,d)}
function Ue(a,b,c){for(var d=a.n,e=a.Pb,f=a.C,g,k,h,l,n,m;b<d;b++)l=Se(a,b,b),k=(b-1)*a.N+1,n=(d-1)*a.N+1,Math.abs(f[l])<Te&&Math.abs(c[b])<Te&&(f[l]=c[b]=0),0!=c[b]&&zl(f[l],c[b],function(a,r){g=b;for(h=l;g<=d;g++,h++){var p=f[h],u=c[g];f[h]=a*p-r*u;c[g]=r*p+a*u}g=1;h=k;for(m=n;g<=d;g++,h++,m++)p=e[h],u=e[m],e[h]=a*p-r*u,e[m]=r*p+a*u});Math.abs(c[d])<Te&&(c[d]=0);f[Se(a,d,d)]=c[d]}
Ce&&(check_error=function(a,b){var c=a.n,d=a.Pb,e=a.C,f=a.p,g=a.m,k,h,l,n,m=0;for(k=1;k<=c;k++)for(h=1;h<=c;h++){n=0;for(l=1;l<=c;l++)n+=d[(k-1)*a.N+l]*g[(l-1)*a.N+h];l=f[h];l=k<=l?e[Se(a,k,l)]:0;n=Math.abs(n-l)/(1+Math.abs(l));m<n&&(m=n)}1E-8<m&&y(b+": dmax = "+m+"; relative error too large")});
function Ke(a,b,c,d){a.ta<a.n&&x("scf_solve_it: singular matrix");if(b){b=a.n;var e=a.Pb,f=a.C,g=a.p,k=a.eg,h,l,n;for(h=1;h<=b;h++)k[h]=c[g[h]+d];for(h=1;h<=b;h++)for(l=Se(a,h,h),n=k[h]/=f[l],g=h+1,l++;g<=b;g++,l++)k[g]-=f[l]*n;for(g=1;g<=b;g++)c[g+d]=0;for(h=1;h<=b;h++)for(n=k[h],g=1,l=(h-1)*a.N+1;g<=b;g++,l++)c[g+d]+=e[l]*n}else{b=a.n;e=a.Pb;f=a.C;k=a.p;h=a.eg;for(var m,g=1;g<=b;g++){m=0;l=1;for(n=(g-1)*a.N+1;l<=b;l++,n++)m+=e[n]*c[l+d];h[g]=m}for(g=b;1<=g;g--){m=h[g];l=b;for(n=Se(a,g,b);l>g;l--,
n--)m-=f[n]*h[l];h[g]=m/f[n]}for(g=1;g<=b;g++)c[k[g]+d]=h[g]}}
var gc=exports.glp_scale_prob=function(a,b){function c(a,b){var c,d,e;d=1;for(c=a.o[b].l;null!=c;c=c.G)if(e=Math.abs(c.j),e=e*c.o.qa*c.g.za,null==c.ya||d>e)d=e;return d}function d(a,b){var c,d,e;d=1;for(c=a.o[b].l;null!=c;c=c.G)if(e=Math.abs(c.j),e=e*c.o.qa*c.g.za,null==c.ya||d<e)d=e;return d}function e(a,b){var c,d,e;d=1;for(c=a.g[b].l;null!=c;c=c.L)if(e=Math.abs(c.j),e=e*c.o.qa*c.g.za,null==c.va||d>e)d=e;return d}function f(a,b){var c,d,e;d=1;for(c=a.g[b].l;null!=c;c=c.L)if(e=Math.abs(c.j),e=e*
c.o.qa*c.g.za,null==c.va||d<e)d=e;return d}function g(a){var b,d,e;for(b=d=1;b<=a.h;b++)if(e=c(a,b),1==b||d>e)d=e;return d}function k(a){var b,c,e;for(b=c=1;b<=a.h;b++)if(e=d(a,b),1==b||c<e)c=e;return c}function h(a,b){var c,e,g;for(e=0;1>=e;e++)if(e==b)for(c=1;c<=a.h;c++)g=d(a,c),Ab(a,c,Cb(a,c)/g);else for(c=1;c<=a.n;c++)g=f(a,c),Bb(a,c,Db(a,c)/g)}function l(a){var b,e,f;for(b=e=1;b<=a.h;b++)if(f=d(a,b)/c(a,b),1==b||e<f)e=f;return e}function n(a){var b,c,d;for(b=c=1;b<=a.n;b++)if(d=f(a,b)/e(a,b),
1==b||c<d)c=d;return c}function m(a){var b,h,m=0,v;h=l(a)>n(a);for(b=1;15>=b;b++){v=m;m=k(a)/g(a);if(1<b&&m>.9*v)break;v=a;for(var H=h,E=void 0,B=E=void 0,J=void 0,B=0;1>=B;B++)if(B==H)for(E=1;E<=v.h;E++)J=c(v,E)*d(v,E),Ab(v,E,Cb(v,E)/Math.sqrt(J));else for(E=1;E<=v.n;E++)J=e(v,E)*f(v,E),Bb(v,E,Db(v,E)/Math.sqrt(J))}}b&~(Uc|Vc|Wc|Xc|hc)&&x("glp_scale_prob: flags = "+b+"; invalid scaling options");b&hc&&(b=Uc|Vc|Xc);(function(a,b){function c(a,b,d,e){return a+": min|aij| = "+b+"  max|aij| = "+d+"  ratio = "+
e+""}var d,e;y("Scaling...");Eb(a);d=g(a);e=k(a);y(c(" A",d,e,e/d));if(.1<=d&&10>=e&&(y("Problem data seem to be well scaled"),b&Xc))return;b&Uc&&(m(a),d=g(a),e=k(a),y(c("GM",d,e,e/d)));b&Vc&&(h(a,l(a)>n(a)),d=g(a),e=k(a),y(c("EQ",d,e,e/d)));if(b&Wc){for(d=1;d<=a.h;d++)Ab(a,d,sg(Cb(a,d)));for(d=1;d<=a.n;d++)Bb(a,d,sg(Db(a,d)));d=g(a);e=k(a);y(c("2N",d,e,e/d))}})(a,b)};
function Qb(a,b){function c(a,b,c,d){var e=a.h,f=a.Ga,g=a.Fa,h=a.Ma;a=a.head[b];if(a<=e)e=1,c[1]=a,d[1]=1;else for(b=f[a-e],e=f[a-e+1]-b,ha(c,1,g,b,e),ha(d,1,h,b,e),c=1;c<=e;c++)d[c]=-d[c];return e}function d(a){var b=od(a.Y,a.h,c,a);a.valid=0==b;return b}function e(a,b,c){var d=a.h,e;if(c<=d){var f=Array(2);e=Array(2);f[1]=c;e[1]=1;b=Me(a.Y,b,1,f,0,e)}else{var g=a.Ga,f=a.Fa,h=a.Ma;e=a.mb;var k;k=g[c-d];c=g[c-d+1];g=0;for(d=k;d<c;d++)e[++g]=-h[d];b=Me(a.Y,b,g,f,k-1,e)}a.valid=0==b;return b}function f(a,
b,c){var d=a.h,e=a.mb,f=a.mb,g=a.h,h=a.Ga,k=a.Fa,l=a.Ma,m=a.head,n,p,q;ha(f,1,b,1,g);for(b=1;b<=g;b++)if(q=c[b],0!=q)if(n=m[b],n<=g)f[n]-=q;else for(p=h[n-g],n=h[n-g+1];p<n;p++)f[k[p]]+=l[p]*q;wd(a.Y,e);for(a=1;a<=d;a++)c[a]+=e[a]}function g(a,b,c){var d=a.h,e=a.mb,f=a.mb,g=a.h,h=a.Ga,k=a.Fa,l=a.Ma,m=a.head,n,p,q,I;for(n=1;n<=g;n++){p=m[n];I=b[n];if(p<=g)I-=c[p];else for(q=h[p-g],p=h[p-g+1];q<p;q++)I+=l[q]*c[k[q]];f[n]=I}yd(a.Y,e);for(a=1;a<=d;a++)c[a]+=e[a]}function k(a,b,c){var d=a.h,e=a.Be,f=a.Jd,
g=a.Ae,h=a.Ce,k;if(c<=d)k=e[c]+f[c]++,g[k]=b,h[k]=1;else{k=a.Ga;var l=a.Fa;a=a.Ma;var m;m=k[c-d];c=k[c-d+1];for(d=m;d<c;d++)k=l[d],k=e[k]+f[k]++,g[k]=b,h[k]=-a[d]}}function h(a,b,c){var d=a.h,e=a.Be,f=a.Jd,g=a.Ae,h=a.Ce,k;if(c<=d){for(d=k=e[c];g[d]!=b;d++);k+=--f[c];g[d]=g[k];h[d]=h[k]}else{k=a.Ga;a=a.Fa;var l,m;m=k[c-d];for(c=k[c-d+1];m<c;m++){l=a[m];for(d=k=e[l];g[d]!=b;d++);k+=--f[l];g[d]=g[k];h[d]=h[k]}}}function l(a,b){var c=a.c,d=a.f,e=a.stat,f,g;f=a.head[a.h+b];switch(e[b]){case M:g=c[f];break;
case P:g=d[f];break;case Ra:g=0;break;case Na:g=c[f]}return g}function n(a,b){var c=a.h,d=a.n,e=a.Ga,g=a.Fa,h=a.Ma,k=a.head,m=a.Gc,n,p,q,I;for(n=1;n<=c;n++)m[n]=0;for(n=1;n<=d;n++)if(p=k[c+n],I=l(a,n),0!=I)if(p<=c)m[p]-=I;else for(q=e[p-c],p=e[p-c+1];q<p;q++)m[g[q]]+=I*h[q];ha(b,1,m,1,c);wd(a.Y,b);f(a,m,b)}function m(a){var b=a.n,c=a.Ta,d=a.Hc,e;e=a.h;var f=a.B,h=a.head,k=a.Gc,l;for(l=1;l<=e;l++)k[l]=f[h[l]];ha(d,1,k,1,e);yd(a.Y,d);g(a,k,d);for(e=1;e<=b;e++){f=a.h;l=a.B;k=h=void 0;h=a.head[f+e];k=
l[h];if(h<=f)k-=d[h];else{l=a.Ga;for(var m=a.Fa,n=a.Ma,p=void 0,q=void 0,p=void 0,p=l[h-f],q=l[h-f+1];p<q;p++)k+=n[p]*d[m[p]]}c[e]=k}}function q(a){var b=a.h,c=a.n,d=a.head,e=a.gd,f=a.gamma,g;a.Ub=1E3;ja(e,1,0,b+c);for(a=1;a<=c;a++)g=d[b+a],e[g]=1,f[a]=1}function r(a,b){var c=a.n,d=a.stat,e=a.Ta,f=a.gamma,g,h,k,l;l=h=0;for(g=1;g<=c;g++){k=e[g];switch(d[g]){case M:if(k>=-b)continue;break;case P:if(k<=+b)continue;break;case Ra:if(-b<=k&&k<=+b)continue;break;case Na:continue}k=k*k/f[g];l<k&&(h=g,l=k)}a.q=
h}function p(a){var b=a.h,c=a.Ab,d=a.Xa,e=a.Xa,f,g;g=a.head[b+a.q];for(f=1;f<=b;f++)e[f]=0;if(g<=b)e[g]=-1;else{var h=a.Ga;f=a.Fa;var k=a.Ma,l;l=h[g-b];for(g=h[g-b+1];l<g;l++)e[f[l]]=k[l]}wd(a.Y,d);e=0;for(f=1;f<=b;f++)0!=d[f]&&(c[++e]=f);a.Wb=e}function u(a){var b=a.h,c=a.Ab,d=a.Xa,e=a.Hc,g,h;h=a.head[b+a.q];for(g=1;g<=b;g++)e[g]=0;if(h<=b)e[h]=-1;else{var k=a.Ga;g=a.Fa;var l=a.Ma,m;m=k[h-b];for(h=k[h-b+1];m<h;m++)e[g[m]]=l[m]}f(a,e,d);e=0;for(g=1;g<=b;g++)0!=d[g]&&(c[++e]=g);a.Wb=e}function v(a,
b){var c=a.Wb,d=a.Ab,e=a.Xa,f,g,h;g=0;for(f=1;f<=c;f++)h=Math.abs(e[d[f]]),g<h&&(g=h);a.mh=g;h=b*(1+.01*g);for(g=0;g<c;)f=d[c],Math.abs(e[f])<h?c--:(g++,d[c]=d[g],d[g]=f);a.nh=g}function H(a,b){var c=a.h,d=a.type,e=a.c,f=a.f,g=a.B,h=a.head,k=a.I,l=a.La,m=a.q,n=a.Ab,p=a.Xa,q=a.nh,I,r,u,v,w,ia,z,B,D;z=0<a.Ta[m]?-1:1;I=h[c+m];d[I]==Q?(m=-1,r=0,D=f[I]-e[I],w=1):(r=m=0,D=t,w=0);for(u=1;u<=q;u++){c=n[u];I=h[c];v=z*p[c];if(0<v)if(1==k&&0>g[I])ia=b*(1+.1*Math.abs(e[I])),B=(e[I]+ia-l[c])/v,I=M;else if(1==
k&&0<g[I])continue;else if(d[I]==Ta||d[I]==Q||d[I]==C)ia=b*(1+.1*Math.abs(f[I])),B=(f[I]+ia-l[c])/v,I=P;else continue;else if(1==k&&0<g[I])ia=b*(1+.1*Math.abs(f[I])),B=(f[I]-ia-l[c])/v,I=P;else if(1==k&&0>g[I])continue;else if(d[I]==Sa||d[I]==Q||d[I]==C)ia=b*(1+.1*Math.abs(e[I])),B=(e[I]-ia-l[c])/v,I=M;else continue;0>B&&(B=0);if(D>B||D==B&&w<Math.abs(v))m=c,r=I,D=B,w=Math.abs(v)}if(!(0==b||0>=m||0==D))for(ia=D,r=m=0,D=t,w=0,u=1;u<=q;u++){c=n[u];I=h[c];v=z*p[c];if(0<v)if(1==k&&0>g[I])B=(e[I]-l[c])/
v,I=M;else if(1==k&&0<g[I])continue;else if(d[I]==Ta||d[I]==Q||d[I]==C)B=(f[I]-l[c])/v,I=P;else continue;else if(1==k&&0<g[I])B=(f[I]-l[c])/v,I=P;else if(1==k&&0>g[I])continue;else if(d[I]==Sa||d[I]==Q||d[I]==C)B=(e[I]-l[c])/v,I=M;else continue;0>B&&(B=0);B<=ia&&w<Math.abs(v)&&(m=c,r=I,D=B,w=Math.abs(v))}a.p=m;0<m&&d[h[m]]==C?a.he=Na:a.he=r;a.oh=z*D}function E(a,b){var c=a.h,d=a.p,e;for(e=1;e<=c;e++)b[e]=0;b[d]=1;yd(a.Y,b)}function B(a,b){var c=a.h,d=a.p,e=a.Hc,f;for(f=1;f<=c;f++)e[f]=0;e[d]=1;g(a,
e,b)}function J(a,b){var c=a.h,d=a.n,e=a.Be,f=a.Jd,g=a.Ae,h=a.Ce,k=a.Yb,l=a.pb,m,n,p,I;for(m=1;m<=d;m++)l[m]=0;for(m=1;m<=c;m++)if(I=b[m],0!=I)for(n=e[m],p=n+f[m];n<p;n++)l[g[n]]-=I*h[n];c=0;for(m=1;m<=d;m++)0!=l[m]&&(k[++c]=m);a.Bc=c}function R(a){var b=a.La,c=a.q,d=a.Wb,e=a.Ab,f=a.Xa,g=a.p,h=a.oh;0<g&&(b[g]=l(a,c)+h);if(0!=h)for(c=1;c<=d;c++)a=e[c],a!=g&&(b[a]+=f[a]*h)}function T(a){var b=a.B,c=a.head,d=a.Wb,e=a.Ab,f=a.Xa,g,h;h=b[c[a.h+a.q]];for(g=1;g<=d;g++)a=e[g],h+=b[c[a]]*f[a];return h}function O(a){var b=
a.Ta,c=a.q,d=a.Bc,e=a.Yb;a=a.pb;var f,g,h;h=b[c]/=a[c];for(g=1;g<=d;g++)f=e[g],f!=c&&(b[f]-=a[f]*h)}function S(a){var b=a.h,c=a.type,d=a.Ga,e=a.Fa,f=a.Ma,g=a.head,h=a.gd,k=a.gamma,l=a.q,m=a.Wb,n=a.Ab,p=a.Xa,I=a.p,q=a.Bc,r=a.Yb,u=a.pb,v=a.Hc,w,ia,z,B,D,E;a.Ub--;B=D=h[g[b+l]]?1:0;for(w=1;w<=b;w++)v[w]=0;for(ia=1;ia<=m;ia++)w=n[ia],h[g[w]]?(v[w]=w=p[w],B+=w*w):v[w]=0;yd(a.Y,v);m=u[l];for(ia=1;ia<=q;ia++)if(a=r[ia],a!=l){w=u[a]/m;n=g[b+a];if(n<=b)E=v[n];else for(E=0,z=d[n-b],p=d[n-b+1];z<p;z++)E-=f[z]*
v[e[z]];p=k[a]+w*w*B+2*w*E;w=(h[n]?1:0)+D*w*w;k[a]=p>=w?p:w;2.220446049250313E-16>k[a]&&(k[a]=2.220446049250313E-16)}c[g[I]]==C?k[l]=1:(k[l]=B/(m*m),2.220446049250313E-16>k[l]&&(k[l]=2.220446049250313E-16))}function G(a){var b=a.h,c=a.head,d=a.stat,e=a.q,f=a.p;a=a.he;var g;if(0>f)switch(d[e]){case M:d[e]=P;break;case P:d[e]=M}else g=c[f],c[f]=c[b+e],c[b+e]=g,d[e]=a}function Z(a,b){var c=a.h,d=a.n,e=a.type,f=a.c,g=a.f,h=a.B,k=a.head,l=a.La,m,n=0,p;b*=.9;for(m=1;m<=c+d;m++)h[m]=0;for(d=1;d<=c;d++){m=
k[d];if(e[m]==Sa||e[m]==Q||e[m]==C)p=b*(1+.1*Math.abs(f[m])),l[d]<f[m]-p&&(h[m]=-1,n++);if(e[m]==Ta||e[m]==Q||e[m]==C)p=b*(1+.1*Math.abs(g[m])),l[d]>g[m]+p&&(h[m]=1,n++)}return n}function Y(a){var b=a.h,c=a.n,d=a.B,e=a.ib;a=a.eb;var f;for(f=1;f<=b;f++)d[f]=0;for(f=1;f<=c;f++)d[b+f]=a*e[f]}function ba(a,b){var c=a.h,d=a.type,e=a.c,f=a.f,g=a.B,h=a.head,k=a.I,l=a.La,m,n,p;for(m=1;m<=c;m++)if(n=h[m],1==k&&0>g[n]){if(p=b*(1+.1*Math.abs(e[n])),l[m]>e[n]+p)return 1}else if(1==k&&0<g[n]){if(p=b*(1+.1*Math.abs(f[n])),
l[m]<f[n]-p)return 1}else{if(d[n]==Sa||d[n]==Q||d[n]==C)if(p=b*(1+.1*Math.abs(e[n])),l[m]<e[n]-p)return 1;if(d[n]==Ta||d[n]==Q||d[n]==C)if(p=b*(1+.1*Math.abs(f[n])),l[m]>f[n]+p)return 1}return 0}function oa(a,b){var c=a.h,d=a.c,e=a.f,f=a.B,g=a.head,h=a.La,k,l,m;for(k=1;k<=c;k++)if(l=g[k],0>f[l]){if(m=b*(1+.1*Math.abs(d[l])),h[k]<d[l]-m)return 1}else if(0<f[l]&&(m=b*(1+.1*Math.abs(e[l])),h[k]>e[l]+m))return 1;return 0}function z(a){var b=a.h,c=a.n,d=a.ib,e=a.head,f=a.La,g,h,k;k=d[0];for(g=1;g<=b;g++)h=
e[g],h>b&&(k+=d[h-b]*f[g]);for(f=1;f<=c;f++)h=e[b+f],h>b&&(k+=d[h-b]*l(a,f));return k}function F(a,b,c){var d=a.h,e=a.type,f=a.c,g=a.f,h=a.I,k=a.head,l=a.La,m,n;if(!(b.s<fc||0<b.cb&&1E3*ma(a.ic)<b.cb||a.da==a.$d||!c&&0!=a.da%b.dc)){m=n=0;for(b=1;b<=d;b++)c=k[b],(e[c]==Sa||e[c]==Q||e[c]==C)&&l[b]<f[c]&&(n+=f[c]-l[b]),(e[c]==Ta||e[c]==Q||e[c]==C)&&l[b]>g[c]&&(n+=l[b]-g[c]),e[c]==C&&m++;y((1==h?" ":"*")+a.da+": obj = "+z(a)+"  infeas = "+n+" ("+m+")");a.$d=a.da}}function D(a,b,c,d,e){var f=a.h,g=a.n,
h=a.eb,k=a.head,l=a.stat,m=a.La,n=a.Ta;b.valid=1;a.valid=0;b.Y=a.Y;a.Y=null;ha(b.head,1,k,1,f);b.ra=c;b.wa=d;b.ea=z(a);b.da=a.da;b.some=e;for(a=1;a<=f;a++)c=k[a],c<=f?(c=b.o[c],c.stat=A,c.bind=a,c.w=m[a]/c.qa):(c=b.g[c-f],c.stat=A,c.bind=a,c.w=m[a]*c.za),c.M=0;for(m=1;m<=g;m++)if(c=k[f+m],c<=f){c=b.o[c];c.stat=l[m];c.bind=0;switch(l[m]){case M:c.w=c.c;break;case P:c.w=c.f;break;case Ra:c.w=0;break;case Na:c.w=c.c}c.M=n[m]*c.qa/h}else{c=b.g[c-f];c.stat=l[m];c.bind=0;switch(l[m]){case M:c.w=c.c;break;
case P:c.w=c.f;break;case Ra:c.w=0;break;case Na:c.w=c.c}c.M=n[m]/c.za/h}}var w,ca=2,L=0,K=0,aa=0,N,da,ea;w=function(a){var b=a.h,c=a.n;a=a.O;var d={};d.h=b;d.n=c;d.type=new Int8Array(1+b+c);d.c=new Float64Array(1+b+c);d.f=new Float64Array(1+b+c);d.B=new Float64Array(1+b+c);d.ib=new Float64Array(1+c);d.Ga=new Int32Array(1+c+1);d.Fa=new Int32Array(1+a);d.Ma=new Float64Array(1+a);d.head=new Int32Array(1+b+c);d.stat=new Int8Array(1+c);d.Be=new Int32Array(1+b+1);d.Jd=new Int32Array(1+b);d.Ae=null;d.Ce=
null;d.La=new Float64Array(1+b);d.Ta=new Float64Array(1+c);d.gd=new Int8Array(1+b+c);d.gamma=new Float64Array(1+c);d.Ab=new Int32Array(1+b);d.Xa=new Float64Array(1+b);d.Yb=new Int32Array(1+c);d.pb=new Float64Array(1+c);d.mb=new Float64Array(1+b);d.Gc=new Float64Array(1+b);d.Hc=new Float64Array(1+b);d.fg=new Float64Array(1+b);return d}(a);(function(a,b){var c=a.h,d=a.n,e=a.type,f=a.c,g=a.f,h=a.B,l=a.ib,m=a.Ga,n=a.Fa,p=a.Ma,I=a.head,q=a.stat,r=a.gd,u=a.gamma,w,v;for(w=1;w<=c;w++)v=b.o[w],e[w]=v.type,
f[w]=v.c*v.qa,g[w]=v.f*v.qa,h[w]=0;for(w=1;w<=d;w++)v=b.g[w],e[c+w]=v.type,f[c+w]=v.c/v.za,g[c+w]=v.f/v.za,h[c+w]=v.B*v.za;l[0]=b.la;ha(l,1,h,c+1,d);e=0;for(w=1;w<=d;w++)e<Math.abs(l[w])&&(e=Math.abs(l[w]));0==e&&(e=1);switch(b.dir){case za:a.eb=1/e;break;case Ea:a.eb=-1/e}1>Math.abs(a.eb)&&(a.eb*=1E3);for(w=l=1;w<=d;w++)for(m[w]=l,e=b.g[w].l;null!=e;e=e.L)n[l]=e.o.ia,p[l]=e.o.qa*e.j*e.g.za,l++;m[d+1]=l;ha(I,1,b.head,1,c);m=0;for(w=1;w<=c;w++)v=b.o[w],v.stat!=A&&(m++,I[c+m]=w,q[m]=v.stat);for(w=1;w<=
d;w++)v=b.g[w],v.stat!=A&&(m++,I[c+m]=c+w,q[m]=v.stat);a.valid=1;b.valid=0;a.Y=b.Y;b.Y=null;I=a.h;q=a.n;m=a.Ga;n=a.Fa;p=a.Be;w=a.Jd;for(l=1;l<=I;l++)w[l]=1;for(l=1;l<=q;l++)for(f=m[l],e=m[l+1];f<e;f++)w[n[f]]++;for(l=p[1]=1;l<=I;l++)w[l]>q&&(w[l]=q),p[l+1]=p[l]+w[l];a.Ae=new Int32Array(p[I+1]);a.Ce=new Float64Array(p[I+1]);I=a.h;q=a.n;m=a.head;n=a.stat;ja(a.Jd,1,0,I);for(p=1;p<=q;p++)n[p]!=Na&&(w=m[I+p],k(a,p,w));a.I=0;a.ic=la();a.Of=a.da=b.da;a.$d=-1;a.Ub=0;ja(r,1,0,c+d);for(w=1;w<=d;w++)u[w]=1})(w,
a);for(b.s>=mc&&y("Objective scale factor = "+w.eb+"");;){if(0==ca){ea=d(w);if(0!=ea)return b.s>=Mb&&(y("Error: unable to factorize the basis matrix ("+ea+")"),y("Sorry, basis recovery procedure not implemented yet")),a.Y=w.Y,w.Y=null,a.ra=a.wa=Aa,a.ea=0,a.da=w.da,a.some=0,ea=Tb;ca=w.valid=1;L=K=0}if(0==L&&(n(w,w.La),L=1,0==w.I&&(0<Z(w,b.Ib)?w.I=1:(Y(w),w.I=2),K=0,F(w,b,1)),ba(w,b.Ib))){b.s>=Mb&&y("Warning: numerical instability (primal simplex, phase "+(1==w.I?"I":"II")+")");ca=w.I=0;aa=5;continue}1!=
w.I||oa(w,b.Ib)||(w.I=2,Y(w),K=0,F(w,b,1));0==K&&(m(w),K=1);switch(b.ed){case oc:0==w.Ub&&q(w)}if(2147483647>b.pc&&w.da-w.Of>=b.pc){if(1!=L||2==w.I&&1!=K){1!=L&&(L=0);2==w.I&&1!=K&&(K=0);continue}F(w,b,1);b.s>=Xb&&y("ITERATION LIMIT EXCEEDED; SEARCH TERMINATED");switch(w.I){case 1:N=Ad;Y(w);m(w);break;case 2:N=ec}r(w,b.vb);da=0==w.q?ec:Ad;D(w,a,N,da,0);return ea=pg}if(2147483647>b.ub&&1E3*ma(w.ic)>=b.ub){if(1!=L||2==w.I&&1!=K){1!=L&&(L=0);2==w.I&&1!=K&&(K=0);continue}F(w,b,1);b.s>=Xb&&y("TIME LIMIT EXCEEDED; SEARCH TERMINATED");
switch(w.I){case 1:N=Ad;Y(w);m(w);break;case 2:N=ec}r(w,b.vb);da=0==w.q?ec:Ad;D(w,a,N,da,0);return ea=Qc}F(w,b,0);r(w,b.vb);if(0==w.q){if(1!=L||1!=K){1!=L&&(L=0);1!=K&&(K=0);continue}F(w,b,1);switch(w.I){case 1:b.s>=Xb&&y("PROBLEM HAS NO FEASIBLE SOLUTION");N=jc;Y(w);m(w);r(w,b.vb);da=0==w.q?ec:Ad;break;case 2:b.s>=Xb&&y("OPTIMAL SOLUTION FOUND"),N=da=ec}D(w,a,N,da,0);return ea=0}p(w);aa&&u(w);v(w,b.ve);var I=w.Ta[w.q],ia=T(w);if(Math.abs(I-ia)>1E-5*(1+Math.abs(ia))||!(0>I&&0>ia||0<I&&0<ia))if(b.s>=
mc&&y("d1 = "+I+"; d2 = "+ia+""),1!=K||!aa){1!=K&&(K=0);aa=5;continue}w.Ta[w.q]=0<I?0<ia?ia:2.220446049250313E-16:0>ia?ia:-2.220446049250313E-16;switch(b.le){case pc:H(w,0);break;case qc:H(w,.3*b.Ib)}if(0==w.p){if(1!=L||1!=K||!aa){1!=L&&(L=0);1!=K&&(K=0);aa=1;continue}F(w,b,1);switch(w.I){case 1:b.s>=Mb&&y("Error: unable to choose basic variable on phase I");a.Y=w.Y;w.Y=null;a.ra=a.wa=Aa;a.ea=0;a.da=w.da;a.some=0;ea=Tb;break;case 2:b.s>=Xb&&y("PROBLEM HAS UNBOUNDED SOLUTION"),D(w,a,ec,jc,w.head[w.h+
w.q]),ea=0}return ea}if(0<w.p&&(I=w.Xa[w.p],ia=1E-5*(1+.01*w.mh),Math.abs(I)<ia&&(b.s>=mc&&y("piv = "+I+"; eps = "+ia+""),!aa))){aa=5;continue}0<w.p&&(I=w.fg,E(w,I),aa&&B(w,I),J(w,I));if(0<w.p&&(I=w.Xa[w.p],ia=w.pb[w.q],Math.abs(I-ia)>1E-8*(1+Math.abs(I))||!(0<I&&0<ia||0>I&&0>ia))){b.s>=mc&&y("piv1 = "+I+"; piv2 = "+ia+"");if(1!=ca||!aa){1!=ca&&(ca=0);aa=5;continue}0==w.pb[w.q]&&(w.Bc++,w.Yb[w.Bc]=w.q);w.pb[w.q]=I}R(w);L=2;0<w.p&&(O(w),K=2,1==w.I&&(I=w.head[w.p],w.Ta[w.q]-=w.B[I],w.B[I]=0));if(0<
w.p)switch(b.ed){case oc:0<w.Ub&&S(w)}0<w.p&&(ea=e(w,w.p,w.head[w.h+w.q]),ca=0==ea?2:w.valid=0);0<w.p&&(h(w,w.q,w.head[w.h+w.q]),w.type[w.head[w.p]]!=C&&k(w,w.q,w.head[w.p]));G(w);w.da++;0<aa&&aa--}}
function Sb(a,b){function c(a,b,c,d){var e=a.h,f=a.Ga,g=a.Fa,h=a.Ma;a=a.head[b];if(a<=e)e=1,c[1]=a,d[1]=1;else for(b=f[a-e],e=f[a-e+1]-b,ha(c,1,g,b,e),ha(d,1,h,b,e),c=1;c<=e;c++)d[c]=-d[c];return e}function d(a){var b=od(a.Y,a.h,c,a);a.valid=0==b;return b}function e(a,b,c){var d=a.h,e;if(c<=d){var f=Array(2);e=Array(2);f[1]=c;e[1]=1;b=Me(a.Y,b,1,f,0,e)}else{var g=a.Ga,f=a.Fa,h=a.Ma;e=a.mb;var k;k=g[c-d];c=g[c-d+1];g=0;for(d=k;d<c;d++)e[++g]=-h[d];b=Me(a.Y,b,g,f,k-1,e)}a.valid=0==b;return b}function f(a,
b,c){var d=a.h,e=a.mb,f=a.mb,g=a.h,h=a.Ga,k=a.Fa,l=a.Ma,m=a.head,n,p,q;ha(f,1,b,1,g);for(b=1;b<=g;b++)if(q=c[b],0!=q)if(n=m[b],n<=g)f[n]-=q;else for(p=h[n-g],n=h[n-g+1];p<n;p++)f[k[p]]+=l[p]*q;wd(a.Y,e);for(a=1;a<=d;a++)c[a]+=e[a]}function g(a,b,c){var d=a.h,e=a.mb,f=a.mb,g=a.h,h=a.Ga,k=a.Fa,l=a.Ma,m=a.head,n,p,q,r;for(n=1;n<=g;n++){p=m[n];r=b[n];if(p<=g)r-=c[p];else for(q=h[p-g],p=h[p-g+1];q<p;q++)r+=l[q]*c[k[q]];f[n]=r}yd(a.Y,e);for(a=1;a<=d;a++)c[a]+=e[a]}function k(a,b){var c=a.c,d=a.f,e=a.stat,
f,g;f=a.head[a.h+b];switch(e[b]){case M:g=c[f];break;case P:g=d[f];break;case Ra:g=0;break;case Na:g=c[f]}return g}function h(a,b){var c=a.h,d=a.n,e=a.Ga,g=a.Fa,h=a.Ma,l=a.head,m=a.Gc,n,p,q,r;for(n=1;n<=c;n++)m[n]=0;for(n=1;n<=d;n++)if(p=l[c+n],r=k(a,n),0!=r)if(p<=c)m[p]-=r;else for(q=e[p-c],p=e[p-c+1];q<p;q++)m[g[q]]+=r*h[q];ha(b,1,m,1,c);wd(a.Y,b);f(a,m,b)}function l(a){var b=a.n,c=a.Ta,d=a.Hc,e;e=a.h;var f=a.B,h=a.head,k=a.Gc,l;for(l=1;l<=e;l++)k[l]=f[h[l]];ha(d,1,k,1,e);yd(a.Y,d);g(a,k,d);for(e=
1;e<=b;e++){f=a.h;l=a.B;k=h=void 0;h=a.head[f+e];k=l[h];if(h<=f)k-=d[h];else{l=a.Ga;for(var m=a.Fa,n=a.Ma,p=void 0,q=void 0,p=void 0,p=l[h-f],q=l[h-f+1];p<q;p++)k+=n[p]*d[m[p]]}c[e]=k}}function n(a){var b=a.h,c=a.n,d=a.head,e=a.gd,f=a.gamma;a.Ub=1E3;ja(e,1,0,b+c);for(a=1;a<=b;a++)c=d[a],e[c]=1,f[a]=1}function m(a,b){var c=a.h,d=a.type,e=a.c,f=a.f,g=a.head,h=a.La,k=a.gamma,l,m,n,p,q,r,u;q=p=n=0;for(l=1;l<=c;l++){m=g[l];u=0;if(d[m]==Sa||d[m]==Q||d[m]==C)r=b*(1+.1*Math.abs(e[m])),h[l]<e[m]-r&&(u=e[m]-
h[l]);if(d[m]==Ta||d[m]==Q||d[m]==C)r=b*(1+.1*Math.abs(f[m])),h[l]>f[m]+r&&(u=f[m]-h[l]);0!=u&&(m=k[l],2.220446049250313E-16>m&&(m=2.220446049250313E-16),m=u*u/m,q<m&&(n=l,p=u,q=m))}a.p=n;a.Qe=p}function q(a,b){var c=a.h,d=a.p,e;for(e=1;e<=c;e++)b[e]=0;b[d]=1;yd(a.Y,N)}function r(a,b){var c=a.h,d=a.p,e=a.Hc,f;for(f=1;f<=c;f++)e[f]=0;e[d]=1;g(a,e,b)}function p(a,b){var c=a.h,d,e;e=0;for(d=1;d<=c;d++)0!=b[d]&&e++;if(.2<=e/c){c=a.h;d=a.n;e=a.Ga;var f=a.Fa,g=a.Ma,h=a.head,k=a.stat,l=a.Yb,m=a.pb,n,p,q,
r,u;r=0;for(n=1;n<=d;n++)if(k[n]==Na)m[n]=0;else{p=h[c+n];if(p<=c)u=-b[p];else for(q=e[p-c],p=e[p-c+1],u=0;q<p;q++)u+=b[f[q]]*g[q];0!=u&&(l[++r]=n);m[n]=u}a.Bc=r}else{f=a.h;c=a.n;g=a.hg;h=a.gg;k=a.ig;l=a.bind;m=a.stat;d=a.Yb;e=a.pb;for(r=1;r<=c;r++)e[r]=0;for(n=1;n<=f;n++)if(p=b[n],0!=p)for(r=l[n]-f,1<=r&&m[r]!=Na&&(e[r]-=p),r=g[n],q=g[n+1],u=r;u<q;u++)r=l[f+h[u]]-f,1<=r&&m[r]!=Na&&(e[r]+=p*k[u]);f=0;for(r=1;r<=c;r++)0!=e[r]&&(d[++f]=r);a.Bc=f}}function u(a,b){var c=a.Bc,d=a.Yb,e=a.pb,f,g,h;g=0;for(f=
1;f<=c;f++)h=Math.abs(e[d[f]]),g<h&&(g=h);a.ph=g;h=b*(1+.01*g);for(g=0;g<c;)f=d[c],Math.abs(e[f])<h?c--:(g++,d[c]=d[g],d[g]=f);a.qh=g}function v(a,b){var c=a.stat,d=a.Ta,e=a.Yb,f=a.pb,g=a.qh,h,k,l,m,n,p,q,r,u;p=0<a.Qe?1:-1;l=0;r=t;n=0;for(k=1;k<=g;k++){h=e[k];m=p*f[h];if(0<m)if(c[h]==M||c[h]==Ra)q=(d[h]+b)/m;else continue;else if(c[h]==P||c[h]==Ra)q=(d[h]-b)/m;else continue;0>q&&(q=0);if(r>q||r==q&&n<Math.abs(m))l=h,r=q,n=Math.abs(m)}if(0!=b&&0!=l&&0!=r)for(u=r,l=0,r=t,n=0,k=1;k<=g;k++){h=e[k];m=
p*f[h];if(0<m)if(c[h]==M||c[h]==Ra)q=d[h]/m;else continue;else if(c[h]==P||c[h]==Ra)q=d[h]/m;else continue;0>q&&(q=0);q<=u&&n<Math.abs(m)&&(l=h,r=q,n=Math.abs(m))}a.q=l;a.Xg=p*r}function H(a){var b=a.h,c=a.Ab,d=a.Xa,e=a.Xa,f,g;g=a.head[b+a.q];for(f=1;f<=b;f++)e[f]=0;if(g<=b)e[g]=-1;else{var h=a.Ga;f=a.Fa;var k=a.Ma,l;l=h[g-b];for(g=h[g-b+1];l<g;l++)e[f[l]]=k[l]}wd(a.Y,d);e=0;for(f=1;f<=b;f++)0!=d[f]&&(c[++e]=f);a.Wb=e}function E(a){var b=a.h,c=a.Ab,d=a.Xa,e=a.Hc,g,h;h=a.head[b+a.q];for(g=1;g<=b;g++)e[g]=
0;if(h<=b)e[h]=-1;else{var k=a.Ga;g=a.Fa;var l=a.Ma,m;m=k[h-b];for(h=k[h-b+1];m<h;m++)e[g[m]]=l[m]}f(a,e,d);e=0;for(g=1;g<=b;g++)0!=d[g]&&(c[++e]=g);a.Wb=e}function B(a){var b=a.Ta,c=a.Bc,d=a.Yb,e=a.pb,f=a.q;a=a.Xg;var g,h;b[f]=a;if(0!=a)for(h=1;h<=c;h++)g=d[h],g!=f&&(b[g]-=e[g]*a)}function J(a){var b=a.La,c=a.p,d=a.q,e=a.Wb,f=a.Ab,g=a.Xa,h;h=a.Qe/g[c];b[c]=k(a,d)+h;if(0!=h)for(d=1;d<=e;d++)a=f[d],a!=c&&(b[a]+=g[a]*h)}function R(a){var b=a.h,c=a.type,d=a.head,e=a.gd,f=a.gamma,g=a.p,h=a.Bc,k=a.Yb,
l=a.pb,m=a.q,n=a.Wb,p=a.Ab,q=a.Xa,r=a.Hc,u,w,v,z,B,D;a.Ub--;B=D=e[d[g]]?1:0;for(u=1;u<=b;u++)r[u]=0;for(z=1;z<=h;z++)if(w=k[z],v=d[b+w],e[v])if(w=l[w],B+=w*w,v<=b)r[v]+=w;else{var E=a.Ga;u=a.Fa;var F=a.Ma,G;G=E[v-b];for(v=E[v-b+1];G<v;G++)r[u[G]]-=w*F[G]}wd(a.Y,r);a=q[g];for(z=1;z<=n;z++)u=p[z],v=d[u],u!=g&&c[d[u]]!=Ka&&(w=q[u]/a,h=f[u]+w*w*B+2*w*r[u],w=(e[v]?1:0)+D*w*w,f[u]=h>=w?h:w,2.220446049250313E-16>f[u]&&(f[u]=2.220446049250313E-16));c[d[b+m]]==Ka?f[g]=1:(f[g]=B/(a*a),2.220446049250313E-16>
f[g]&&(f[g]=2.220446049250313E-16));v=d[g];if(c[v]==C&&e[v])for(e[v]=0,z=1;z<=n;z++){u=p[z];if(u==g){if(c[d[b+m]]==Ka)continue;w=1/q[g]}else{if(c[d[u]]==Ka)continue;w=q[u]/q[g]}f[u]-=w*w;2.220446049250313E-16>f[u]&&(f[u]=2.220446049250313E-16)}}function T(a){var b=a.h,c=a.type,d=a.head,e=a.bind,f=a.stat,g=a.p,h=a.Qe;a=a.q;var k;k=d[g];d[g]=d[b+a];d[b+a]=k;e[d[g]]=g;e[d[b+a]]=b+a;f[a]=c[k]==C?Na:0<h?M:P}function O(a,b){var c=a.h,d=a.n,e=a.cc,f=a.head,g=a.Ta,h,k;for(h=1;h<=d;h++)if(k=f[c+h],g[h]<-b&&
(e[k]==Sa||e[k]==Ka)||g[h]>+b&&(e[k]==Ta||e[k]==Ka))return 1;return 0}function S(a){var b=a.h,c=a.n,d=a.type,e=a.c,f=a.f,g=a.cc,h=a.head,k=a.stat;a=a.Ta;var l;for(l=1;l<=b+c;l++)switch(g[l]){case Ka:d[l]=Q;e[l]=-1E3;f[l]=1E3;break;case Sa:d[l]=Q;e[l]=0;f[l]=1;break;case Ta:d[l]=Q;e[l]=-1;f[l]=0;break;case Q:case C:d[l]=C,e[l]=f[l]=0}for(e=1;e<=c;e++)l=h[b+e],k[e]=d[l]==C?Na:0<=a[e]?M:P}function G(a){var b=a.h,c=a.n,d=a.type,e=a.c,f=a.f,g=a.ad,h=a.bd,k=a.head,l=a.stat,m=a.Ta;ha(d,1,a.cc,1,b+c);ha(e,
1,g,1,b+c);ha(f,1,h,1,b+c);for(a=1;a<=c;a++)switch(g=k[b+a],d[g]){case Ka:l[a]=Ra;break;case Sa:l[a]=M;break;case Ta:l[a]=P;break;case Q:l[a]=2.220446049250313E-16<=m[a]?M:-2.220446049250313E-16>=m[a]?P:Math.abs(e[g])<=Math.abs(f[g])?M:P;break;case C:l[a]=Na}}function Z(a,b){var c=a.n,d=a.stat,e=a.Ta,f;for(f=1;f<=c;f++)if(e[f]<-b&&(d[f]==M||d[f]==Ra)||e[f]>+b&&(d[f]==P||d[f]==Ra))return 1;return 0}function Y(a){var b=a.h,c=a.n,d=a.ib,e=a.head,f=a.La,g,h,l;l=d[0];for(g=1;g<=b;g++)h=e[g],h>b&&(l+=d[h-
b]*f[g]);for(f=1;f<=c;f++)h=e[b+f],h>b&&(l+=d[h-b]*k(a,f));return l}function ba(a,b,c){var d=a.h,e=a.n,f=a.B,g=a.cc,h=a.head,l=a.stat,m=a.I,n=a.La,p=a.Ta;if(!(b.s<fc||0<b.cb&&1E3*ma(a.ic)<b.cb||a.da==a.$d||!c&&0!=a.da%b.dc)){b=0;if(1==m){for(l=1;l<=d;l++)b-=f[h[l]]*n[l];for(n=1;n<=e;n++)b-=f[h[d+n]]*k(a,n)}else for(n=1;n<=e;n++)0>p[n]&&(l[n]==M||l[n]==Ra)&&(b-=p[n]),0<p[n]&&(l[n]==P||l[n]==Ra)&&(b+=p[n]);e=0;for(l=1;l<=d;l++)g[h[l]]==C&&e++;1==a.I?y(" "+a.da+":  infeas = "+b+" ("+e+")"):y("|"+a.da+
": obj = "+Y(a)+"  infeas = "+b+" ("+e+")");a.$d=a.da}}function oa(a,b,c,d,e){var f=a.h,g=a.n,h=a.eb,k=a.head,l=a.stat,m=a.La,n=a.Ta;b.valid=1;a.valid=0;b.Y=a.Y;a.Y=null;ha(b.head,1,k,1,f);b.ra=c;b.wa=d;b.ea=Y(a);b.da=a.da;b.some=e;for(a=1;a<=f;a++)c=k[a],c<=f?(c=b.o[c],c.stat=A,c.bind=a,c.w=m[a]/c.qa):(c=b.g[c-f],c.stat=A,c.bind=a,c.w=m[a]*c.za),c.M=0;for(m=1;m<=g;m++)if(c=k[f+m],c<=f){c=b.o[c];c.stat=l[m];c.bind=0;switch(l[m]){case M:c.w=c.c;break;case P:c.w=c.f;break;case Ra:c.w=0;break;case Na:c.w=
c.c}c.M=n[m]*c.qa/h}else{c=b.g[c-f];c.stat=l[m];c.bind=0;switch(l[m]){case M:c.w=c.c;break;case P:c.w=c.f;break;case Ra:c.w=0;break;case Na:c.w=c.c}c.M=n[m]/c.za/h}}this.chrome_workaround_1=function(a,b){var c=a.Ga,d=a.Fa,e=a.Ma,f=a.n,g,h,k;for(k=h=1;k<=f;k++)for(c[k]=h,g=b.g[k].l;null!=g;g=g.L)d[h]=g.o.ia,e[h]=g.o.qa*g.j*g.g.za,h++;c[f+1]=h};this.chrome_workaround_2=function(a,b){var c,d,e,f=a.hg,g=a.gg,h=a.ig,k=a.h;for(d=c=1;d<=k;d++)for(f[d]=c,e=b.o[d].l;null!=e;e=e.G)g[c]=e.g.H,h[c]=e.o.qa*e.j*
e.g.za,c++;f[k+1]=c};var z,F=2,D=0,w=0,ca=0,L,K,aa;z=function(a){var b=a.h,c=a.n;a=a.O;var d={};d.h=b;d.n=c;d.type=new Int8Array(1+b+c);d.c=new Float64Array(1+b+c);d.f=new Float64Array(1+b+c);d.B=new Float64Array(1+b+c);d.cc=new Int8Array(1+b+c);d.ad=new Float64Array(1+b+c);d.bd=new Float64Array(1+b+c);d.ib=new Float64Array(1+c);d.Ga=new Int32Array(1+c+1);d.Fa=new Int32Array(1+a);d.Ma=new Float64Array(1+a);d.hg=new Int32Array(1+b+1);d.gg=new Int32Array(1+a);d.ig=new Float64Array(1+a);d.head=new Int32Array(1+
b+c);d.bind=new Int32Array(1+b+c);d.stat=new Int8Array(1+c);d.La=new Float64Array(1+b);d.Ta=new Float64Array(1+c);d.gd=new Int8Array(1+b+c);d.gamma=new Float64Array(1+b);d.Yb=new Int32Array(1+c);d.pb=new Float64Array(1+c);d.Ab=new Int32Array(1+b);d.Xa=new Float64Array(1+b);d.mb=new Float64Array(1+b);d.Gc=new Float64Array(1+b);d.Hc=new Float64Array(1+b);d.fg=new Float64Array(1+b);return d}(a);(function(a,b){var c=a.h,d=a.n,e=a.type,f=a.c,g=a.f,h=a.B,k=a.cc,l=a.ad,m=a.bd,n=a.ib,p=a.head,q=a.bind,r=
a.stat,u=a.gd,w=a.gamma,v,z;for(v=1;v<=c;v++)z=b.o[v],e[v]=z.type,f[v]=z.c*z.qa,g[v]=z.f*z.qa,h[v]=0;for(v=1;v<=d;v++)z=b.g[v],e[c+v]=z.type,f[c+v]=z.c/z.za,g[c+v]=z.f/z.za,h[c+v]=z.B*z.za;ha(k,1,e,1,c+d);ha(l,1,f,1,c+d);ha(m,1,g,1,c+d);n[0]=b.la;ha(n,1,h,c+1,d);e=0;for(v=1;v<=d;v++)e<Math.abs(n[v])&&(e=Math.abs(n[v]));0==e&&(e=1);switch(b.dir){case za:a.eb=1/e;break;case Ea:a.eb=-1/e}1>Math.abs(a.eb)&&(a.eb*=1E3);for(v=1;v<=d;v++)h[c+v]*=a.eb;chrome_workaround_1(a,b);chrome_workaround_2(a,b);ha(p,
1,b.head,1,c);h=0;for(v=1;v<=c;v++)z=b.o[v],z.stat!=A&&(h++,p[c+h]=v,r[h]=z.stat);for(v=1;v<=d;v++)z=b.g[v],z.stat!=A&&(h++,p[c+h]=c+v,r[h]=z.stat);for(h=1;h<=c+d;h++)q[p[h]]=h;a.valid=1;b.valid=0;a.Y=b.Y;b.Y=null;a.I=0;a.ic=la();a.Of=a.da=b.da;a.$d=-1;a.Ub=0;ja(u,1,0,c+d);for(v=1;v<=c;v++)w[v]=1})(z,a);for(b.s>=mc&&y("Objective scale factor = "+z.eb+"");;){if(0==F){aa=d(z);if(0!=aa)return b.s>=Mb&&(y("Error: unable to factorize the basis matrix ("+aa+")"),y("Sorry, basis recovery procedure not implemented yet")),
a.Y=z.Y,z.Y=null,a.ra=a.wa=Aa,a.ea=0,a.da=z.da,a.some=0,aa=Tb;F=z.valid=1;D=w=0}if(0==w&&(l(z),w=1,0==z.I&&(0!=O(z,.9*b.vb)?(z.I=1,S(z)):(z.I=2,G(z)),D=z.Ub=0),0!=Z(z,b.vb))){b.s>=Mb&&y("Warning: numerical instability (dual simplex, phase "+(1==z.I?"I":"II")+")");if(b.hb==Rb)return oa(z,a,Aa,Aa,0),aa=Tb;F=z.I=0;ca=5;continue}1==z.I&&0==O(z,b.vb)&&(ba(z,b,1),z.I=2,1!=w&&(l(z),w=1),G(z),D=z.Ub=0);0==D&&(h(z,z.La),2==z.I&&(z.La[0]=Y(z)),D=1);switch(b.ed){case oc:0==z.Ub&&n(z)}if(2==z.I&&0>z.eb&&b.ef>
-t&&z.La[0]<=b.ef){if(1!=D||1!=w){1!=D&&(D=0);1!=w&&(w=0);continue}ba(z,b,1);b.s>=Xb&&y("OBJECTIVE LOWER LIMIT REACHED; SEARCH TERMINATED");oa(z,a,Ad,ec,0);return aa=Tf}if(2==z.I&&0<z.eb&&b.ff<+t&&z.La[0]>=b.ff){if(1!=D||1!=w){1!=D&&(D=0);1!=w&&(w=0);continue}ba(z,b,1);b.s>=Xb&&y("OBJECTIVE UPPER LIMIT REACHED; SEARCH TERMINATED");oa(z,a,Ad,ec,0);return aa=Uf}if(2147483647>b.pc&&z.da-z.Of>=b.pc){if(2==z.I&&1!=D||1!=w){2==z.I&&1!=D&&(D=0);1!=w&&(w=0);continue}ba(z,b,1);b.s>=Xb&&y("ITERATION LIMIT EXCEEDED; SEARCH TERMINATED");
switch(z.I){case 1:K=Ad;G(z);h(z,z.La);break;case 2:K=ec}oa(z,a,Ad,K,0);return aa=pg}if(2147483647>b.ub&&1E3*ma(z.ic)>=b.ub){if(2==z.I&&1!=D||1!=w){2==z.I&&1!=D&&(D=0);1!=w&&(w=0);continue}ba(z,b,1);b.s>=Xb&&y("TIME LIMIT EXCEEDED; SEARCH TERMINATED");switch(z.I){case 1:K=Ad;G(z);h(z,z.La);break;case 2:K=ec}oa(z,a,Ad,K,0);return aa=Qc}ba(z,b,0);m(z,b.Ib);if(0==z.p){if(1!=D||1!=w){1!=D&&(D=0);1!=w&&(w=0);continue}ba(z,b,1);switch(z.I){case 1:b.s>=Xb&&y("PROBLEM HAS NO DUAL FEASIBLE SOLUTION");G(z);
h(z,z.La);L=Ad;K=jc;break;case 2:b.s>=Xb&&y("OPTIMAL SOLUTION FOUND"),L=K=ec}oa(z,a,L,K,0);return aa=0}var N=z.fg;q(z,N);ca&&r(z,N);p(z,N);u(z,b.Ib);switch(b.le){case pc:v(z,0);break;case qc:v(z,.3*b.vb)}if(0==z.q){if(1!=D||1!=w||!ca){1!=D&&(D=0);1!=w&&(w=0);ca=1;continue}ba(z,b,1);switch(z.I){case 1:b.s>=Mb&&y("Error: unable to choose basic variable on phase I");a.Y=z.Y;z.Y=null;a.ra=a.wa=Aa;a.ea=0;a.da=z.da;a.some=0;aa=Tb;break;case 2:b.s>=Xb&&y("PROBLEM HAS NO FEASIBLE SOLUTION"),oa(z,a,jc,ec,
z.head[z.p]),aa=0}return aa}var da=z.pb[z.q],ea=1E-5*(1+.01*z.ph);if(Math.abs(da)<ea&&(b.s>=mc&&y("piv = "+da+"; eps = "+ea+""),!ca)){ca=5;continue}H(z);ca&&E(z);da=z.Xa[z.p];ea=z.pb[z.q];if(Math.abs(da-ea)>1E-8*(1+Math.abs(da))||!(0<da&&0<ea||0>da&&0>ea)){b.s>=mc&&y("piv1 = "+da+"; piv2 = "+ea+"");if(1!=F||!ca){1!=F&&(F=0);ca=5;continue}0==z.Xa[z.p]&&(z.Wb++,z.Ab[z.Wb]=z.p);z.Xa[z.p]=ea}J(z);2==z.I&&(z.La[0]+=z.Ta[z.q]/z.eb*(z.Qe/z.Xa[z.p]));D=2;B(z);w=2;switch(b.ed){case oc:0<z.Ub&&R(z)}aa=e(z,
z.p,z.head[z.h+z.q]);F=0==aa?2:z.valid=0;T(z);z.da++;0<ca&&ca--}};
}(typeof exports === 'object' && exports || this));
/**
 * Number of combinations of k items among n
 * @param{number}
 * @param{number}
 * @return{number}
 */  
function nchoosek(n,k) {
	if ( k > n || k < 0 || n < 0) 
		return 0;

	var i;
	var res = 1;
	for ( i=n-k+1; i <= n; i++)
		res *= i;
	for (i=2; i <= k; i++)
		res /= i;		
	return res;
}

//////////////////////////////////////////////
//  Multivariate Gaussian random vectors
//////////////////////////////////////////////
function mvnrnd(mu, Sigma, N) {
	if ( arguments.length < 3 )
		var N = 1; 
		
	var X = randn(N,mu.length);
	
	if ( issymmetric(Sigma) )
		var L = chol(Sigma);
	else 
		var L = Sigma; // L directly provided instead of Sigma
	
	return add(mul(ones(N),transpose(mu)), mul(X, transpose(L) ));
}

//////////////////////////////////////////////
// Generic class for Distributions
/////////////////////////////////////////////
function Distribution (distrib, arg1, arg2 ) {
	
	if ( arguments.length < 1 ) {
		error("Error in new Distribution(name): name is undefined.");
		return undefined;
	}
	
	if (typeof(distrib) == "string") 
		distrib = eval(distrib);

	this.type = "Distribution:" + distrib.name;

	this.distribution = distrib.name;

	// Functions that depend on the distrib:
	this.construct = distrib.prototype.construct; 

	this.estimate = distrib.prototype.estimate; 
	this.sample = distrib.prototype.sample; 
	this.pdf = distrib.prototype.pdf;
	if( distrib.prototype.pmf )
		this.pmf = distrib.prototype.pmf;  
	
	if( distrib.prototype.logpdf )
		this.logpdf = distrib.prototype.logpdf;  
	else
		this.logpdf = function ( x ) { return log(this.pdf(x)); };
		
//	this.cdf = distrib.prototype.cdf; 
	
	// Initialization depending on distrib
	this.construct(arg1, arg2);
}

Distribution.prototype.construct = function ( params ) {
	// Read params and create the required fields for a specific algorithm
	
}

Distribution.prototype.pdf = function ( x ) {
	// return value of PDF at x
}

Distribution.prototype.sample = function ( N ) {
	// Return N samples
}

Distribution.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	// !! this function should also update this.mean and this.variance
}


Distribution.prototype.info = function () {
	// Print information about the distribution
	
	var str = "{<br>";
	var i;
	var Functions = new Array();
	for ( i in this) {
		switch ( type( this[i] ) ) {
			case "string":
			case "boolean":
			case "number":
				str += i + ": " + this[i] + "<br>";
				break;
			case "vector":
				str += i + ": " + printVector(this[i]) + "<br>";
				break;
			case "matrix":
				str += i + ": matrix of size " + this[i].m + "-by-" + this[i].n + "<br>";
				break;
			case "function": 
				Functions.push( i );
				break;
			default:
				str += i + ": " + typeof(this[i]) + "<br>";
				break;			
		}
	}
	str += "<i>Functions: " + Functions.join(", ") + "</i><br>";
	str += "}";
	return str;
}


///////////////////////////////
///  Uniform 
///////////////////////////////
function Uniform ( params ) {
	var that = new Distribution ( Uniform, params ) ;
	return that;
}


Uniform.prototype.construct = function ( a, b ) {
	// Read params and create the required fields for a Uniform distribution
	if ( typeof(a) == "undefined" ) {
		// default to continuous uniform in [-1,1];
		this.isDiscrete = false;
		this.a = -1;
		this.b = 1;
		this.dimension = 1;
	
		this.px = 0.5;
		this.mean = 0;
		this.variance = 1/3;
		this.std = Math.sqrt(this.variance);	
	}
	else {
		if ( typeof(b) == "undefined" ) {
			this.isDiscrete = true; 
			if ( typeof(a) == "number") 
				this.values = range(a);
			else 
				this.values = a; 
			this.dimension = 1;	
			this.mean = ( min(this.values) + max(this.values) ) / 2;
			this.variance = (this.values.length * this.values.length - 1 ) / 12;
			this.std = Math.sqrt(this.variance);
		}
		else {
			this.isDiscrete = false; 
			this.a = a;
			this.b = b;
			this.dimension = size(a,1);
		
			this.px = 1 / prod(sub(b,a)); 
			this.mean = mul(0.5, add(a, b));
			var b_a = sub(b,a);
			this.variance = entrywisediv( entrywisemul(b_a,b_a), 12);
			this.std = sqrt(this.variance);
		}
	}
}

Uniform.prototype.pdf = function ( x ) {
	// return value of PDF at x
	const tx = type(x);
	var p = undefined;	
	if (this.isDiscrete) {
		var pdfscalar = function ( s, values ) {
			return ( values.indexOf(s) < 0 ) ? 0 : (1/values.length) ;
		};

		if ( tx == "number" ) {
			p = pdfscalar(x, this.values);
		}
		else if ( tx == "vector" ) {
			p = zeros(x.length);
			for ( var i=0; i < x.length; i++) 
				p[i] = pdfscalar(x[i], this.values);		
		}
		else if ( tx == "matrix" ) {
			p = zeros(x.m, x.n);
			for ( var i=0; i < x.m*x.n; i++)
				p.val[i] = pdfscalar(x.val[i], this.values);
		}
	}
	else {
		var pdfscalar = function ( s , l, u, px) {
			return ( s >= l && s <= u ) ? px : 0;
		};
		
		if ( tx == "number" ) {
			if ( this.dimension == 1 )
				p = pdfscalar(x, this.a, this.b, this.px);
		}
		else if ( tx == "vector" ) {
			if ( this.dimension == 1 ) {
				p = zeros(x.length);
				for ( var i=0; i < x.length; i++)
					p[i] = pdfscalar(x[i], this.a, this.b, this.px);
			}
			else if ( this.dimension == x.length ) {
				p = pdfscalar(x[0], this.a[0], this.b[0], this.px);
				var k = 1;
				while ( k < x.length && p != 0 ) {
					p *= pdfscalar(x[k], this.a[k], this.b[k], this.px);
					k++;
				}
			}
		}
		else if ( tx == "matrix" ) {
			if ( this.dimension == 1 ) {
				p = zeros(x.m, x.n);
				for ( var i=0; i < x.m*x.n; i++)
					p.val[i] = pdfscalar(x.val[i], this.a, this.b, this.px);
			}
			else if ( this.dimension == x.n ) {
				p = zeros(x.m);
				for ( var i=0; i < x.m; i++) {
					p[i] = pdfscalar(x.val[i*x.n], this.a[0], this.b[0], this.px);
					var k = 1;
					while ( k < x.n && p[i] != 0 ) {
						p[i] *= pdfscalar(x.val[i*x.n+k], this.a[k], this.b[k], this.px);
						k++;
					}
				}
			}
		}
	}
	return p;
}
Uniform.prototype.sample = function ( N ) {
	// Return N samples
	if ( typeof(N) == "undefined" )
		var N = 1;
		
	if ( this.isDiscrete ) {
		var s = zeros(N); 
		for(var i=0; i < N; i++) {
			var r = Math.random(); 
			var k = 1;
			var n = this.values.length;
			while ( r > k / n )
				k++;
			s[i] = this.values[k-1];
		}
		if ( N == 1)
			return s[0];
		else
			return s;
	}
	else {
		if ( this.dimension == 1 )
			return add(entrywisemul(this.b-this.a, rand(N)), this.a); 
		else {
			return add(entrywisemul(outerprod(ones(N), sub(this.b,this.a)), rand(N, this.dimension)), outerprod(ones(N),this.a) ); 
		}
	}
}

Uniform.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	const tX = type(X);
	
	// Detect if X contains discrete or continuous values
	if ( tX == "matrix" )
		var x = X.val;
	else
		var x = X;
		
	var i = 0;
	while ( i < x.length && Math.round(x[i]) == x[i] )
		i++;
	if ( i < x.length ) 
		this.isDiscrete = false;
	else
		this.isDiscrete = true;
		
	// Estimate
	if ( this.isDiscrete) {
		for ( i = 0; i < x.length; i++ ) {
			var xi = Math.round(x[i]);
			if ( this.values.indexOf(xi) < 0 ) 
				this.values.push(xi);		
		}
		this.dimension = 1;	
		this.mean = ( min(this.values) + max(this.values) ) / 2;
		this.variance = (this.values.length * this.values.length - 1 ) / 12;
		this.std = Math.sqrt(this.variance);
	}
	else {
		if ( tX == "matrix" ) {
			this.a = min(X,1).val; 
			this.b = max(X).val; 
			this.dimension = this.a.length;
		}
		else {
			this.a = minVector(X);
			this.b = maxVector(X);
			this.dimension = 1;
		}
		this.mean = mul(0.5, add(this.a, this.b));
		var b_a = sub(this.b,this.a);
		this.variance = entrywisediv( entrywisemul(b_a,b_a), 12);
		this.std = sqrt(this.variance);
		this.px = 1 / prod(sub(this.b,this.a)); 		
	}	
	return this;
}


///////////////////////////////
///  Gaussian 
/// (with independent components in multiple dimension)
///////////////////////////////
function Gaussian ( params ) {
	var that = new Distribution ( Gaussian, params ) ;
	return that;
}


Gaussian.prototype.construct = function ( mean, variance ) {
	// Read params and create the required fields for a specific algorithm
	if ( typeof(mean) == "undefined" ) 
		var mu = 1;
		
	else if ( type(mean) == "matrix") 
		var mu = mean.val;
	else
		var mu = mean;
		
	var dim = size(mu,1) ;

	if ( typeof(variance) == "undefined") {
		if ( dim == 1)
			var variance = 1;
		else
			var variance = ones(dim);
	}

	this.mean = mu;
	this.variance = variance;
	this.std = sqrt(this.variance);
	this.dimension = dim;
}

Gaussian.prototype.pdf = function ( x ) {
	// return value of PDF at x
	if ( this.dimension == 1 ) {
		if ( typeof(x) == "number") {
			var diff = x - this.mean;
			return Math.exp(-diff*diff / (2*this.variance)) / (this.std * Math.sqrt(2*Math.PI) );
		}
		else {
			var diff = sub(x, this.mean);
			return entrywisediv ( exp( entrywisediv(entrywisemul( diff, diff), -2* this.variance) ), this.std * Math.sqrt(2*Math.PI) ) ;
		} 
	}
	else {  
		if ( type(x) == "vector") {
			if (x.length != this.dimension ) {
				error ( "Error in Gaussian.pdf(x): x.length = " + x.length + " != " + this.dimension + " = Gaussian.dimension.");
				return undefined;
			}
			var diff = subVectors(x, this.mean );
			var u = -0.5 * dot( diff, divVectors(diff, this.variance) );
			return Math.exp(u) /  ( Math.pow(2*Math.PI, 0.5*this.dimension) * Math.sqrt(prodVector(this.variance)) );
		}
		else {
			if (x.n != this.dimension ) {
				error ( "Error in Gaussian.pdf(X): X.n = " + x.n + " != " + this.dimension + " = Gaussian.dimension.");
				return undefined;
			}

			var p = zeros(x.m); 
			var denominator = Math.pow(2*Math.PI, 0.5*this.dimension) * Math.sqrt(prodVector(this.variance)) ;
			for ( var i=0; i < x.m; i++) {
				var diff = subVectors(x.row(i), this.mean );
				var u = -0.5 * dot( diff, divVectors(diff, this.variance) );
				p[i] = Math.exp(u) / denominator;		
			}
			return p;
		}
	}
}

Gaussian.prototype.sample = function ( N ) {
	// Return N samples
	if ( typeof(N) == "undefined")
		var N = 1;

	if ( N == 1 ) 
		var X = add(entrywisemul(this.std, randn(this.dimension)), this.mean);
	else {
		var N1 = ones(N);
		var X = add(entrywisemul(outerprod(N1, this.std), randn(N,this.dimension)), outerprod(N1,this.mean));
	}
	return X;
}

Gaussian.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	if ( type ( X ) == "matrix" ) {
		this.mean = mean(X,1).val;
		this.variance = variance(X,1).val;
		this.std = undefined;
		this.dimension = X.n;
	}
	else {
		this.mean = mean(X);
		this.variance = variance(X);
		this.std = Math.sqrt(this.variance);
		this.dimension = 1;
	}
	return this;
}
///////////////////////////////
///  Gaussian 
/// (with independent components in multiple dimension)
///////////////////////////////
function mvGaussian ( params ) {
	var that = new Distribution ( mvGaussian, params ) ;
	return that;
}


mvGaussian.prototype.construct = function ( mean, covariance ) {
	// Read params and create the required fields for a specific algorithm
	if ( typeof(mean) == "undefined" ) 
		var mu = 1;
		
	else if ( type(mean) == "matrix") 
		var mu = mean.val;
	else
		var mu = mean;
		
	var dim = size(mu,1) ;

	if ( typeof(covariance) == "undefined") {
		if ( dim == 1)
			var covariance = 1;
		else
			var covariance = eye(dim);
	}

	this.mean = mu;
	this.variance = covariance;
	this.dimension = dim;
	
	this.L = chol(this.variance);
	if ( typeof(this.L) == "undefined" )
		error("Error in new Distribution (mvGaussian, mu, Sigma): Sigma is not positive definite");
	
	this.det = det(this.variance);
}

mvGaussian.prototype.pdf = function ( x ) {
	// return value of PDF at x
	if ( this.dimension == 1 ) {
		if ( typeof(x) == "number") {
			var diff = x - this.mean;
			return Math.exp(-diff*diff / (2*this.variance)) / (Math.sqrt(2*this.variance*Math.PI) );
		}
		else {
			var diff = sub(x, this.mean);
			return entrywisediv ( exp( entrywisediv(entrywisemul( diff, diff), -2* this.variance) ), Math.sqrt(2*this.variance*Math.PI) ) ;
		}
	}
	else {  
		if ( type(x) == "vector") {
			if (x.length != this.dimension ) {
				error ( "Error in mvGaussian.pdf(x): x.length = " + x.length + " != " + this.dimension + " = mvGaussian.dimension.");
				return undefined;
			}
			var diff = subVectors(x, this.mean );
			var u = -0.5 * dot( diff, cholsolve(this.L, diff) );
			return Math.exp(u) /   Math.sqrt( Math.pow(2*Math.PI, this.dimension) * this.det ) ;
		}
		else {
			if (x.n != this.dimension ) {
				error ( "Error in Gaussian.pdf(X): X.n = " + x.n + " != " + this.dimension + " = Gaussian.dimension.");
				return undefined;
			}

			var p = zeros(x.m); 
			var denominator = Math.sqrt( Math.pow(2*Math.PI, this.dimension) * this.det ) ;
			for ( var i=0; i < x.m; i++) {
				var diff = subVectors(x.row(i), this.mean );
				var u = -0.5 * dot( diff, cholsolve(this.L, diff) );
				p[i] = Math.exp(u) / denominator;		
			}
			return p;
		}
	}
}

mvGaussian.prototype.sample = function ( N ) {
	// Return N samples
	if ( typeof(N) == "undefined")
		var N = 1;
		
	var X = add(mul(randn(N,this.dimension), transpose(this.L)), outerprod(ones(N),this.mean));
	
	if ( N == 1) 
		return X.val;
	else
		return X;
}

mvGaussian.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	if ( type ( X ) == "matrix" ) {
		this.mean = mean(X,1).val;
		this.variance = cov(X); 
		this.dimension = X.n;
		this.L = chol(this.variance);
		if ( typeof(this.L) == "undefined" )
			error("Error in mvGaussian.estimate(X): covariance estimate is not positive definite");
	
		this.det = det(this.variance);
		return this;
	}
	else {
		error("mvGaussian.estimate( X ) needs a matrix X");
	}
}



///////////////////////////////
///  Bernoulli 
///////////////////////////////
function Bernoulli ( params ) {
	var that = new Distribution ( Bernoulli, params ) ;
	return that;
}


Bernoulli.prototype.construct = function ( mean ) {
	// Read params and create the required fields for a specific algorithm
	if ( typeof(mean) == "undefined" ) 
		var mean = 0.5;

	var dim = size(mean,1); 

	this.mean = mean;
	this.variance = entrywisemul(mean, sub(1, mean)) ;
	this.std = sqrt(this.variance);
	this.dimension = dim;	
}

Bernoulli.prototype.pdf = Bernoulli.prototype.pmf = function ( x ) {
	// return value of PDF at x
	const tx = type(x);
	
	var pdfscalar = function ( s, mu ) {
		if ( s == 1 ) 
			return mu;
		else if ( s == 0)
			return (1-mu);
		else
			return 0;
	};
	
	if ( this.dimension == 1 ) {
		if ( tx == "number" ) {
			return pdfscalar(x, this.mean);
		}
		else if ( tx == "vector") {
			var p = zeros(x.length);
			for(var i = 0; i < x.length ; i++){
				p[i] = pdfscalar(x[i], this.mean);
			}
			return p;
		}
		else if ( tx == "matrix") {
			var P = zeros(x.m, x.n);
			var mn = x.m*x.n;
			for(var k = 0; k < mn ; k++){
				P.val[k] = pdfscalar(x.val[k], this.mean);
			}
			return P;
		}
	}
	else {
		switch( tx ) {
		case "vector":
			var p = pdfscalar(x[0], this.mean[0]);
			for (var k = 1; k < this.dimension; k++)
				p *= pdfscalar(x[k], this.mean[k]);
			break;
			
		case "spvector":
			var p = 1;
			for (var j=0; j < x.ind[0] ; j++)
				p *= (1-this.mean[j]);
			for (var k =0; k < x.val.length - 1; k++) {
				p *= this.mean[x.ind[k]];
				for (var j=x.ind[k]+1; j < x.ind[k+1] ; j++)
					p *= (1-this.mean[j]);
			}
			p *= this.mean[x.ind[k]];
			for (var j=x.ind[k]+1; j < this.dimension ; j++)
				p *= (1-this.mean[j]);			
			break;
			
		case "matrix":
			var p = zeros(x.m); 
			for (var i=0; i < x.m; i++) {
				p[i] = pdfscalar(x.val[i*x.n], this.mean[0]);
				for (var k = 1; k < x.n; k++)
					p[i] *= pdfscalar(x.val[i*x.n + k], this.mean[k]);			
			}
			break;
		case "spmatrix":
			var p = ones(x.m);
			for (var i=0; i < x.m; i++) {
				var xr = x.row(i);	// could be faster without this...
				for (var j=0; j < xr.ind[0] ; j++)
					p[i] *= (1-this.mean[j]);
				for (var k =0; k < xr.val.length - 1; k++) {
					p[i] *= this.mean[xr.ind[k]];
					for (var j=xr.ind[k]+1; j < xr.ind[k+1] ; j++)
						p[i] *= (1-this.mean[j]);
				}
				p[i] *= this.mean[xr.ind[k]];
				for (var j=xr.ind[k]+1; j < this.dimension ; j++)
					p[i] *= (1-this.mean[j]);	
			}				
			break;
		default:
			var p = undefined;
			break;			
		}
		return p;
	}
	
}

Bernoulli.prototype.logpdf = Bernoulli.prototype.logpmf = function ( x ) {
	// return value of logPDF at x
	const tx = type(x);
	
	var logpdfscalar = function ( s, mu ) {
		if ( s == 1 ) 
			return Math.log(mu);
		else if ( s == 0)
			return Math.log(1-mu);
		else
			return -Infinity;
	};
	
	if ( this.dimension == 1 ) {
		if ( tx == "number" ) {
			return logpdfscalar(x, this.mean);
		}
		else if ( tx == "vector") {
			var p = zeros(x.length);
			for(var i = 0; i < x.length ; i++){
				p[i] = logpdfscalar(x[i], this.mean);
			}
			return p;
		}
		else if ( tx == "matrix") {
			var P = zeros(x.m, x.n);
			var mn = x.m*x.n;
			for(var k = 0; k < mn ; k++){
				P.val[k] = logpdfscalar(x.val[k], this.mean);
			}
			return P;
		}
	}
	else {
		switch( tx ) {
		case "vector":
			var p = 0;
			for (var k = 0; k < this.dimension; k++)
				p += logpdfscalar(x[k], this.mean[k]);
			break;
			
		case "spvector":
			var p = 0;
			for (var j=0; j < x.ind[0] ; j++)
				p += Math.log(1-this.mean[j]);
			for (var k =0; k < x.val.length - 1; k++) {
				p += Math.log(this.mean[x.ind[k]]);
				for (var j=x.ind[k]+1; j < x.ind[k+1] ; j++)
					p += Math.log(1-this.mean[j]);
			}
			p += Math.log(this.mean[x.ind[k]]);
			for (var j=x.ind[k]+1; j < this.dimension ; j++)
				p += Math.log(1-this.mean[j]);			
			break;
			
		case "matrix":
			var p = zeros(x.m); 
			for (var i=0; i < x.m; i++) {
				for (var k = 0; k < x.n; k++)
					p[i] += logpdfscalar(x.val[i*x.n + k], this.mean[k]);			
			}
			break;
		case "spmatrix":
			var p = zeros(x.m); 
			for (var i=0; i < x.m; i++) {
				var xr = x.row(i);	// could be faster without this...
				for (var j=0; j < xr.ind[0] ; j++)
					p[i] += Math.log(1-this.mean[j]);
				for (var k =0; k < xr.val.length - 1; k++) {
					p[i] += Math.log(this.mean[xr.ind[k]]);
					for (var j=xr.ind[k]+1; j < xr.ind[k+1] ; j++)
						p[i] += Math.log(1-this.mean[j]);
				}
				p[i] += Math.log(this.mean[xr.ind[k]]);
				for (var j=xr.ind[k]+1; j < this.dimension ; j++)
					p[i] += Math.log(1-this.mean[j]);						
			}
			break;
		default:
			var p = undefined;
			break;			
		}
		return p;
	}
	
}

Bernoulli.prototype.sample = function ( N ) {
	// Return N samples
	if ( typeof(N) == "undefined" || N == 1 ) {
		return isLower(rand(this.dimension) , this.mean);
	}
	else {
		return isLower(rand(N, this.dimension) , outerprod(ones(N), this.mean) );		
	}
}


Bernoulli.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	switch ( type ( X ) ) {
	case "matrix":
	case "spmatrix":
		this.mean = mean(X,1).val;
		this.variance = entrywisemul(this.mean, sub(1, this.mean)) ;
		this.std = sqrt(this.variance);
		this.dimension = X.n;
		break;
	case "vector":
	case "spvector":
		this.dimension = 1;
		this.mean = mean(X) ;
		this.variance = this.mean * (1-this.mean);
		this.std = Math.sqrt(this.variance);
		break;
	default:
		error("Error in Bernoulli.estimate( X ): X must be a (sp)matrix or (sp)vector.");
		break;
	}
	return this;
}


///////////////////////////////
///  Poisson 
///////////////////////////////
function Poisson ( params ) {
	var that = new Distribution ( Poisson, params ) ;
	return that;
}


Poisson.prototype.construct = function ( mean ) {
	// Read params and create the required fields for a specific algorithm
	if ( typeof(mean) == "undefined" ) 
		var mean = 5;

	var dim = size(mean,1); 

	this.mean = mean;
	this.variance = this.mean;
	this.std = sqrt(this.variance);
	this.dimension = dim;	
}

Poisson.prototype.pdf = Poisson.prototype.pmf = function ( x ) {
	// return value of PDF at x
	const tx = type(x);
	
	var pdfscalar = function ( s, lambda ) {
		if ( s < 0 || Math.round(s) != s ) 
			return 0;
		else if ( s == 0)
			return 1;
		else {
			var u = lambda;
			for ( var k = 2; k <= s; k++ )
				u *= lambda / k;
			return Math.exp(-lambda) * u;
		}
	};
	
	if ( this.dimension == 1 ) {
		if ( tx == "number" ) {
			return pdfscalar(x, this.mean);
		}
		else if ( tx == "vector") {
			var p = zeros(x.length);
			for(var i = 0; i < x.length ; i++){
				p[i] = pdfscalar(x[i], this.mean);
			}
			return p;
		}
		else if ( tx == "matrix") {
			var P = zeros(x.m, x.n);
			var mn = x.m*x.n;
			for(var k = 0; k < mn ; k++){
				P.val[k] = pdfscalar(x.val[k], this.mean);
			}
			return p;
		}
	}
	else {
		if ( tx == "vector" ) {
			var p = pdfscalar(x[0], this.mean[0]);
			for (var k =0; k < this.dimension; k++)
				p *= pdfscalar(x[k], this.mean[k]);
			
			return p;
		}
		else if ( tx == "matrix") {
			var p = zeros(x.m); 
			for (var i=0; i < x.m; i++) {
				p[i] = pdfscalar(x.val[i*x.n], this.mean[0]);
				for (var k =0; k < x.n; k++)
					p[i] *= pdfscalar(x.val[i*x.n + k], this.mean[k]);			
			}
			return p;			
		}
	}
	
}

Poisson.prototype.sample = function ( N ) {
	// Return N samples
	var samplescalar = function (lambda) {
		var x = Math.random();
		var n = 0;
		const exp_lambda = Math.exp(-lambda);
		while (x > exp_lambda) {
			x *= Math.random();
			n++;
		}
		return n;
	};
	
	if ( typeof(N) == "undefined" || N == 1 ) {
		if ( this.dimension == 1 )
			return samplescalar(this.mean);
		else {
			var s = zeros(this.dimension);
			for ( k=0; k < this.dimension; k++)
				s[k] = samplescalar(this.mean[k]);
			return s;
		}
	}
	else {
		if ( this.dimension == 1 ) {
			var S = zeros(N);
			for ( var i=0; i < N; i++) 
				S[i] =  samplescalar(this.mean);
			return S;
		}
		else {
			var S = zeros(N, this.dimension);
			for ( var i=0; i < N; i++) {
				for ( k=0; k < this.dimension; k++)
					S[i*this.dimension + k] = samplescalar(this.mean[k]);
			}
			return S;			
		}
	}
}


Poisson.prototype.estimate = function ( X ) {
	// Estimate dsitribution from the N-by-d matrix X
	if ( type ( X ) == "matrix" ) {
		this.mean = mean(X,1).val;
		this.variance = this.mean;
		this.std = sqrt(this.variance);
		this.dimension = X.n;
	}
	else { // X is a vector samples 
		this.dimension = 1;
		this.mean = mean(X) ;
		this.variance = this.mean;
		this.std = Math.sqrt(this.variance);
	}
	return this;
}

const Complex_I = new Complex(0, 1);

/**
 * @constructor
 * @struct
 */
function Complex(a, b, polar) {
	/** @const */ this.type = "Complex";
	
	if ( typeof(a) == "undefined") {
		this.re = 0.0;
		this.im = 0.0;
	}
	else if ( a instanceof Complex ) {
		this.re = a.re;
		this.im = a.im;
	}
	else if ( typeof(a) == "number" && !polar ) {
		this.re = a;
		this.im = b;
	}
	else {
		this.re = a * Math.cos(b);
		this.im = a * Math.sin(b);
	}
}

Complex.prototype.toString = function () {
	return this.re + (this.im >= 0 ? " + " : " - ") + Math.abs(this.im) + "i";
}
Complex.prototype.info = function () {
	return this.re + (this.im >= 0 ? " + " : " - ") + Math.abs(this.im) + "i";
}
/**
 * @param {Complex}
 * @param {Complex}
 * @return {Complex} 
 */
function addComplex(a,b) {
	var z = new Complex(a);
	z.re += b.re; 
	z.im += b.im;
	return z;
}
/**
 * @param {Complex}
 * @param {number}
 * @return {Complex} 
 */
function addComplexReal(a,b) {
	var z = new Complex(a);
	z.re += b;
	return z;
}
/**
 * @param {Complex}
 * @param {Complex}
 * @return {Complex} 
 */
function subComplex(a,b) {
	var z = new Complex(a);
	z.re -= b.re;
	z.im -= b.im;
	return z;
}
/**
 * @param {Complex}
 * @return {Complex} 
 */
function minusComplex(a) {
	return new Complex(-a.re, -a.im);
}

function mulComplex(a,b) {
	return new Complex(a.re*b.re - a.im*b.im, a.im * b.re + a.re*b.im);
}
function mulComplexReal(a,b) {
	return new Complex(a.re*b, a.im * b);
}
function divComplex(a,b) {
	var denom = b.re*b.re + b.im*b.im;
	return new Complex( (a.re*b.re + a.im*b.im) / denom, (a.im * b.re - a.re*b.im) / denom );
}

function conj(z) {
	if (z instanceof Complex)
		return new Complex(z.re, -z.im);
	else if (z instanceof ComplexVector) {
		var r = new ComplexVector(z);
		for (var i=0; i < z.length; i++)
			r.im[i] = -r.im[i];
		return r;
	}	
	else if (z instanceof ComplexMatrix) {
		var r = new ComplexMatrix(z);
		for (var i=0; i < z.length; i++)
			r.im[i] = -r.im[i];
		return r;
	}		
	else 
		return new Complex(z);	// for a real
}

function modulus(z) {
	if ( z instanceof Complex ) 
		return Math.sqrt(z.re*z.re + z.im*z.im);
	else if (z instanceof ComplexVector)
		return sqrt(addVectors( entrywisemulVector(z.re, z.re), entrywisemulVector(z.im, z.im) )); 
	else if (z instanceof ComplexVector)
		return new Matrix(z.m, z.n, sqrt(addVectors( entrywisemulVector(z.re, z.re), entrywisemulVector(z.im, z.im) ) , true)); 
}
var absComplex = modulus;

function expComplex(z) {
	return new Complex(Math.exp(z.re), z.im, true); 	
}



/**
 * @constructor
 * @struct
 */
function ComplexVector(a, b, dontcopy) {
	/** @const */ this.type = "ComplexVector";
	
	if ( arguments.length == 0 ) {
		// dummy call, probably in renewObject 
		// while loading data from a file
	}
	else if ( a instanceof ComplexVector) {
		/** @const */ this.length = a.length;
		this.re = vectorCopy(a.re);
		this.im = vectorCopy(a.im);
	}
	else if (typeof(a) == "number") {
		/** @const */ this.length = a;
		this.re = new Float64Array(a);
		this.im = new Float64Array(a);		
	}
	else if ( a instanceof Float64Array && b instanceof Float64Array ) {
		/** @const */ this.length = a.length;
		if ( typeof(dontcopy) == "undefined" || !dontcopy ){
			this.re = vectorCopy(a);
			this.im = vectorCopy(b);
		}
		else {
			this.re = a;
			this.im = b;
		}
	}
	else {
		error("Bad arguments to new ComplexVector()");
	}
}

/**
 * @constructor
 * @struct
 */
function ComplexMatrix(a, b, values, valuesimag) {
	/** @const */ this.type = "ComplexMatrix";
		
	if ( arguments.length == 0 ) {
		// dummy call, probably in renewObject 
		// while loading data from a file
	}
	else if ( a instanceof ComplexMatrix) {
		/** @const */ this.length = a.length;
		/** @const */ this.m = a.m;
		/** @const */ this.n = a.n;
		/** @const */ this.size = [a.m, a.n]; 
		this.re = vectorCopy(a.re);
		this.im = vectorCopy(a.im);
	}
	else if (typeof(a) == "number" && typeof(b) == "number") {
		/** @const */ this.length = a;
		/** @const */ this.m = a;
		/** @const */ this.n = b;
		/** @const */ this.size = [a, b]; 
		if ( typeof(values) == "undefined") {
			this.re = new Float64Array(a*b);
			this.im = new Float64Array(a*b);
		}
		else if ( values instanceof ComplexVector ) {
			this.re = vectorCopy(values.re);
			this.im = vectorCopy(values.im);
		}
		else if ( values instanceof Float64Array && typeof(valuesimag) != "undefined" &&  valuesimag instanceof Float64Array) {
			this.re = values;
			this.im = valuesimag;	// !! no copy!
		}
	}
	else if ( a instanceof Matrix && b instanceof Matrix) {
		/** @const */ this.length = a.length;
		/** @const */ this.m = a.m;
		/** @const */ this.n = a.n;
		/** @const */ this.size = [a.m, a.n]; 
		this.re = vectorCopy(a.val);
		this.im = vectorCopy(b.val);
	}
	else 
		error("Bad arguments to new ComplexMatrix()");
}


ComplexVector.prototype.toString = function () {
	return "[" + this.type + " of size " + this.length + "]";
}
ComplexMatrix.prototype.toString = function () {
	return "[" + this.type + " of size " + this.m + " x " + this.n + "]";
}
ComplexVector.prototype.get = function (i) {
	return new Complex(this.re[i], this.im[i]);
}
ComplexMatrix.prototype.get = function (i,j) {
	return new Complex(this.re[i*this.n + j], this.im[i*this.n + j]);
}
ComplexVector.prototype.set = function (i, z) {
	if ( typeof(z) == "number" )  {
		this.re[i] = z;
		this.im[i] =	0;
	}
	else {
		this.re[i] = z.re;
		this.im[i] = z.im;
	}
}
ComplexMatrix.prototype.set = function (i, j, z) {
	if ( typeof(z) == "number" )  {
		this.re[i*this.n + j] = z;
		this.im[i*this.n + j] =	0;
	}
	else {
		this.re[i*this.n + j] = z.re;
		this.im[i*this.n + j] = z.im;
	}
}
ComplexVector.prototype.getSubVector = function (rowsrange) {
	const n = rowsrange.length;
	var res = new ComplexVector( n );
	for (var i = 0; i< n; i++) {
		res.re[i] = this.re[rowsrange[i]];
		res.im[i] = this.im[rowsrange[i]];
	}
	return res;
}
ComplexVector.prototype.setVectorScalar = function (rowsrange, B) {
	var i;
	for (i = 0; i< rowsrange.length; i++) 
		A.set ( rowsrange[i], B);
}
ComplexVector.prototype.setVectorVector = function (rowsrange, B) {
	var i;
	for (i = 0; i< rowsrange.length; i++) 
		A.set(rowsrange[i], B[i]);
}



function real(z) {
	if (z instanceof Complex) 
		return z.re;
	else if (z instanceof ComplexVector)
		return vectorCopy(z.re);
	else if (z instanceof ComplexMatrix)
		return new Matrix(z.m, z.n, z.re);
	else
		return copy(z);		
}
function imag(z) {
	if (z instanceof Complex) 
		return z.im;
	else if (z instanceof ComplexVector)
		return vectorCopy(z.im);
	else if (z instanceof ComplexMatrix)
		return new Matrix(z.m, z.n, z.im);
	else
		return 0;		
}

/**
 * @param {MatrixComplex} 
 */
function transposeComplexMatrix ( A ) {
	// Hermitian transpose = conjugate transpose
	const m = A.m;
	const n = A.n;
	if ( m > 1 ) {
		var i;
		var j;
		var res = new ComplexMatrix( n,m);
		var Aj = 0;
		for ( j=0; j< m;j++) {
			var ri = 0;
			for ( i=0; i < n ; i++) {
				res.re[ri + j] = A.re[Aj + i];
				res.im[ri + j] = -A.im[Aj + i];
				ri += m;
			}
			Aj += n;
		}
		return res;
	}
	else {
		return new ComplexVector(A.re,minusVector(A.im));
	}
}
/**
 * @param {MatrixComplex} 
 */
ComplexMatrix.prototype.transpose = function ( ) {
	// simple Transpose without conjugate
	const m = A.m;
	const n = A.n;
	if ( m > 1 ) {
		var i;
		var j;
		var res = new ComplexMatrix( n,m);
		var Aj = 0;
		for ( j=0; j< m;j++) {
			var ri = 0;
			for ( i=0; i < n ; i++) {
				res.re[ri + j] = A.re[Aj + i];
				res.im[ri + j] = A.im[Aj + i];
				ri += m;
			}
			Aj += n;
		}
		return res;
	}
	else {
		return new ComplexVector(A.re,A.im);
	}
}


/**
 * @param {ComplexVector}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function addComplexVectors(a, b) {
	var z = new ComplexVector(a);
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re[i] += b.re[i];
		z.im[i] += b.im[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function subComplexVectors(a, b) {
	var z = new ComplexVector(a);
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re[i] -= b.re[i];
		z.im[i] -= b.im[i];
	}
	return z;
}

/**
 * @param {ComplexMatrix}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function addComplexMatrices(a, b) {
	var z = new ComplexMatrix(a);
	const mn = a.m * a.n;
	for ( var i=0; i< mn; i++) {
		z.re[i] += b.re[i];
		z.im[i] += b.im[i];
	}
	return z;
}

/**
 * @param {ComplexMatrix}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function subComplexMatrices(a, b) {
	var z = new ComplexMatrix(a);
	const mn = a.m * a.n;
	for ( var i=0; i< mn; i++) {
		z.re[i] -= b.re[i];
		z.im[i] -= b.im[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @param {Float64Array}
 * @return {ComplexVector} 
 */
function addComplexVectorVector(a, b) {
	var z = new ComplexVector(a);
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re[i] += b[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @param {Float64Array}
 * @return {ComplexVector} 
 */
function subComplexVectorVector(a, b) {
	var z = new ComplexVector(a);
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re[i] -= b[i];		
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {Matrix}
 * @return {ComplexMatrix} 
 */
function addComplexMatrixMatrix(a, b) {
	var z = new ComplexMatrix(a);
	const n = a.m * a.n;
	for ( var i=0; i< n; i++) {
		z.re[i] += b.val[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {Matrix}
 * @return {ComplexMatrix} 
 */
function subComplexMatrixMatrix(a, b) {
	var z = new ComplexMatrix(a);
	const n = a.m * a.n;
	for ( var i=0; i< n; i++) {
		z.re[i] -= b.val[i];
	}
	return z;
}

/**
 * @param {number}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function addScalarComplexVector(a, b) {
	var z = new ComplexVector(b);
	const n = b.length;
	for ( var i=0; i< n; i++) {
		z.re[i] += a;
	}
	return z;
}
/**
 * @param {number}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function subScalarComplexVector(a, b) {
	var z = minusComplexVector(b);
	const n = b.length;
	for ( var i=0; i< n; i++) {
		z.re[i] += a;
	}
	return z;
}

/**
 * @param {number}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function addScalarComplexMatrix(a, b) {
	var z = new ComplexMatrix(b);
	const n = b.m * b.n;
	for ( var i=0; i< n; i++) {
		z.re[i] += a;
	}
	return z;
}



/**
 * @param {ComplexVector}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function entrywisemulComplexVectors(a, b) {
	const n = a.length;
	var z = new ComplexVector(n);
	for ( var i=0; i< n; i++) {
		z.re[i] = a.re[i] * b.re[i] - a.im[i] * b.im[i];
		z.im[i] = a.im[i] * b.re[i] + a.re[i] * b.im[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function entrywisedivComplexVectors(a, b) {
	const n = a.length;
	var z = new ComplexVector(n);
	for ( var i=0; i< n; i++) {
		var bre = b.re[i];
		var bim = b.im[i]; 
		var denom = bre*bre + bim*bim;
		z.re[i] = (a.re[i]*bre + a.im[i]*bim) / denom;
		z.im[i] = (a.im[i]*bre - a.re[i]*bim) / denom;		
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function entrywisemulComplexMatrices(a, b) {
	const n = a.m * a.n;
	var z = new ComplexMatrix(a.m, a.n);
	for ( var i=0; i< n; i++) {
		z.re[i] = a.re[i] * b.re[i] - a.im[i] * b.im[i];
		z.im[i] = a.im[i] * b.re[i] + a.re[i] * b.im[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function entrywisedivComplexMatrices(a, b) {
	const n = a.m * a.n;
	var z = new ComplexMatrix(a.m, a.n);
	for ( var i=0; i< n; i++) {
		var bre = b.re[i];
		var bim = b.im[i]; 
		var denom = bre*bre + bim*bim;
		z.re[i] = (a.re[i]*bre + a.im[i]*bim) / denom;
		z.im[i] = (a.im[i]*bre - a.re[i]*bim) / denom;		
	}
	return z;
}

/**
 * @param {ComplexVector}
 * @param {Float64Array}
 * @return {ComplexVector} 
 */
function entrywisemulComplexVectorVector(a, b) {
	const n = a.length;
	var z = new ComplexVector(n);
	for ( var i=0; i< n; i++) {
		z.re[i] = a.re[i] * b[i];
		z.im[i] = a.im[i] * b[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {Matrix}
 * @return {ComplexMatrix} 
 */
function entrywisemulComplexMatrixMatrix(a, b) {
	const n = a.m * a.n;
	var z = new ComplexMatrix(a.m, a.n);
	for ( var i=0; i< n; i++) {
		z.re[i] = a.re[i] * b.val[i];
		z.im[i] = a.im[i] * b.val[i];
	}
	return z;
}

/**
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function minusComplexVector(a) {
	const n = a.length;
	var z = new ComplexVector(n);
	for ( var i=0; i< n; i++) {
		z.re[i] = -a.re[i];
		z.im[i] = -a.im[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function minusComplexMatrix(a) {
	var z = new ComplexMatrix(a.m, a.n);
	const n = a.m * a.n;
	for ( var i=0; i< n; i++) {
		z.re[i] = -a.re[i];
		z.im[i] = -a.im[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @return {number} 
 */
function sumComplexVector(a) {
	var z = new Complex();
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re += a.re[i];
		z.im += a.im[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @return {number} 
 */
function sumComplexMatrix(a) {
	var z = new Complex();
	const n = a.m * a.n;
	for ( var i=0; i< n; i++) {
		z.re += a.re[i];
		z.im += a.im[i];
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @return {number} 
 */
function norm1ComplexVector(a) {
	var r = 0.0;
	const n = a.length;
	for ( var i=0; i< n; i++) {
		r += Math.sqrt(a.re[i] * a.re[i] + a.im[i]*a.im[i]);		
	}
	return r;
}
/**
 * @param {ComplexVector}
 * @return {number} 
 */
function norm2ComplexVector(a) {
	var r = 0.0;
	const n = a.length;
	for ( var i=0; i< n; i++) {
		r += a.re[i] * a.re[i] + a.im[i]*a.im[i];
	}
	return Math.sqrt(r);
}
/**
 * @param {ComplexMatrix}
 * @return {number} 
 */
function normFroComplexMatrix(a) {
	var r = 0.0;
	const n = a.m * a.n;
	for ( var i=0; i< n; i++) {
		r += a.re[i] * a.re[i] + a.im[i]*a.im[i];
	}
	return Math.sqrt(r);
}
/**
 * @param {ComplexVector}
 * @param {ComplexVector}
 * @return {Complex} 
 */
function dotComplexVectors(a, b) {
	// = b^H a = conj(b)^T a
	var z = new Complex(); 
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re += a.re[i] * b.re[i] + a.im[i] * b.im[i];
		z.im += a.im[i] * b.re[i] - a.re[i] * b.im[i]
	}
	return z;
}
/**
 * @param {ComplexVector}
 * @param {Float64Array}
 * @return {Complex} 
 */
function dotComplexVectorVector(a, b) {
	// = b^T a
	var z = new Complex(); 
	const n = a.length;
	for ( var i=0; i< n; i++) {
		z.re += a.re[i] * b[i];
		z.im += a.im[i] * b[i];
	}
	return z;
}
/**
 * @param {number}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function mulScalarComplexVector(a, b) {
	var re = mulScalarVector(a, b.re);
	var im = mulScalarVector(a, b.im);
	return new ComplexVector(re,im, true);
}
/**
 * @param {Complex}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function mulComplexComplexVector(a, b) {
	const n = b.length;
	var z = new ComplexVector(n);
	var are = a.re;
	var aim = a.im; 
	for ( var i=0; i< n; i++) {
		z.re[i] = are * b.re[i] - aim * b.im[i];
		z.im[i] = aim * b.re[i] + are * b.im[i];
	}
	return z;
}
/**
 * @param {Complex}
 * @param {Float64Array}
 * @return {ComplexVector} 
 */
function mulComplexVector(a, b) {
	const n = b.length;
	var z = new ComplexVector(n);
	var are = a.re;
	var aim = a.im; 
	for ( var i=0; i< n; i++) {
		z.re[i] = are * b[i];
		z.im[i] = aim * b[i];
	}
	return z;
}
/**
 * @param {number}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function mulScalarComplexMatrix(a, b) {
	var re = mulScalarVector(a, b.re);
	var im = mulScalarVector(a, b.im);
	return new ComplexMatrix(b.m, b.n, re, im);
}
/**
 * @param {Complex}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function mulComplexComplexMatrix(a, b) {
	const n = b.m*b.n;
	var z = new ComplexMatrix(b.m,b.n);
	var are = a.re;
	var aim = a.im; 
	for ( var i=0; i< n; i++) {
		z.re[i] = are * b.re[i] - aim * b.im[i];
		z.im[i] = aim * b.re[i] + are * b.im[i];
	}
	return z;
}
/**
 * @param {Complex}
 * @param {Matrix}
 * @return {ComplexMatrix} 
 */
function mulComplexMatrix(a, b) {
	const n = b.m * b.n;
	var z = new ComplexMatrix(b.m, b.n);
	var are = a.re;
	var aim = a.im; 
	for ( var i=0; i< n; i++) {
		z.re[i] = are * b.val[i];
		z.im[i] = aim * b.val[i];
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {Float64Array}
 * @return {ComplexVector} 
 */
function mulComplexMatrixVector(a, b) {
	const m = a.m;
	const n = a.n;
	var z = new ComplexVector(m); 
	var ai = 0;
	for ( var i=0; i< m; i++) {
		for ( j=0; j < n ; j++) {
			z.re[i] += a.re[ai+j] * b[j];
			z.im[i] += a.im[ai+j] * b[j];
		}
		ai += n;
	}
	return z;
}
/**
 * @param {ComplexMatrix}
 * @param {ComplexVector}
 * @return {ComplexVector} 
 */
function mulComplexMatrixComplexVector(a, b) {
	const m = a.m;
	const n = a.n;
	var z = new ComplexVector(m); 
	var ai = 0;
	for ( var i=0; i< m; i++) {
		for ( j=0; j < n ; j++) {
			z.re[i] += a.re[ai+j] * b.re[j] - a.im[ai+j] * b.im[j];
			z.im[i] += a.im[ai+j] * b.re[j] + a.re[ai+j] * b.im[j];
		}
		ai += n;
	}
	return z;
}

/**
 * @param {ComplexMatrix}
 * @param {ComplexMatrix}
 * @return {ComplexMatrix} 
 */
function mulComplexMatrices(A, B) {
	const m = A.length;
	const n = B.n;
	const n2 = B.length;
	
	var Are = A.re; 
	var Aim = A.im;
	var Bre = B.re;
	var Bim = B.im;
	
	var Cre = new Float64Array(m*n);
	var Cim = new Float64Array(m*n);	
	var aik;
	var Aik = 0;
	var Ci = 0;
	for (var i=0;i < m ; i++) {		
		var bj = 0;
		for (var k=0; k < n2; k++ ) {
			aikre = Are[Aik];
			aikim = Aim[Aik];
			for (var j =0; j < n; j++) {
				Cre[Ci + j] += aikre * Bre[bj] - aikim * Bim[bj];
				Cim[Ci + j] += aikre * Bim[bj] + aikim * Bre[bj];
				bj++;
			}	
			Aik++;					
		}
		Ci += n;
	}
	return  new ComplexMatrix(m,n,Cre, Cim);
}
/**
 * @param {ComplexMatrix}
 * @param {Matrix}
 * @return {ComplexMatrix} 
 */
function mulComplexMatrixMatrix(A, B) {
	const m = A.m;
	const n = B.n;
	const n2 = B.m;
	
	var Are = A.re; 
	var Aim = A.im;
	var Bre = B.val;
	
	var Cre = new Float64Array(m*n);
	var Cim = new Float64Array(m*n);	
	var aik;
	var Aik = 0;
	var Ci = 0;
	for (var i=0;i < m ; i++) {		
		var bj = 0;
		for (var k=0; k < n2; k++ ) {
			aikre = Are[Aik];
			aikim = Aim[Aik];
			for (var j =0; j < n; j++) {
				Cre[Ci + j] += aikre * Bre[bj];
				Cim[Ci + j] += aikim * Bre[bj];
				bj++;
			}	
			Aik++;					
		}
		Ci += n;
	}
	return  new ComplexMatrix(m,n,Cre, Cim);
}



/**
 * @param {Float64Array|ComplexVector}
 * @return {ComplexVector} 
 */
function fft(x) {
	const n = x.length;
	const s = Math.log2(n);
	const m = n/2;
	
	if ( s % 1 != 0 ) {
		error("fft(x) only implemented for x.length = 2^m. Use dft(x) instead.");
		return undefined;
	}

	var X = new ComplexVector(x,zeros(n));
		
	// bit reversal:	
	var j = 0;
	for (var i = 0; i < n-1 ; i++) {
		if (i < j) {
			// swap(X[i], X[j])
			var Xi = X.re[i];
			X.re[i] = X.re[j];
			X.re[j] = Xi;
			Xi = X.im[i];
			X.im[i] = X.im[j];
			X.im[j] = Xi;
		}
		
		var k = m;
		while (k <= j) {
			j -= k;
			k /= 2;
		}
		j += k;
	}
	
	// FFT:
	var l2 = 1;
	var c = new Complex(-1,0);
	var u = new Complex();
	for (var l = 0; l < s; l++) {
		var l1 = l2;
		l2 *= 2;
		u.re = 1;
		u.im = 0;
      	for (var j = 0; j < l1; j++) {
        	for (var i = j; i < n; i += l2) {
		        var i1 = i + l1;
		        //var t1 = mulComplex(u, X.get(i1) );
		        var t1re = u.re * X.re[i1] - u.im * X.im[i1]; // t1 = u * X[i1]
		        var t1im = u.im * X.re[i1] + u.re * X.im[i1];

		        X.re[i1] = X.re[i] - t1re;
		        X.im[i1] = X.im[i] - t1im;
		        	        
		        X.re[i] += t1re;
		        X.im[i] += t1im;
	        }

			u = mulComplex(u, c);
		}

		c.im = -Math.sqrt((1.0 - c.re) / 2.0);
		c.re = Math.sqrt((1.0 + c.re) / 2.0);
	}
	return X;
}
/**
 * @param {ComplexVector}
 * @return {ComplexVector|Float64Array} 
 */
function ifft(x) {
	const n = x.length;
	const s = Math.log2(n);
	const m = n/2;
	
	if ( s % 1 != 0 ) {
		error("ifft(x) only implemented for x.length = 2^m. Use idft(x) instead.");
		return undefined;
	}
	
	
	var X = new ComplexVector(x,zeros(n));
		
	// bit reversal:	
	var j = 0;
	for (var i = 0; i < n-1 ; i++) {
		if (i < j) {
			// swap(X[i], X[j])
			var Xi = X.re[i];
			X.re[i] = X.re[j];
			X.re[j] = Xi;
			Xi = X.im[i];
			X.im[i] = X.im[j];
			X.im[j] = Xi;
		}
		
		var k = m;
		while (k <= j) {
			j -= k;
			k /= 2;
		}
		j += k;
	}
	
	// iFFT:
	var l2 = 1;
	var c = new Complex(-1,0);
	var u = new Complex();
	for (var l = 0; l < s; l++) {
		var l1 = l2;
		l2 *= 2;
		u.re = 1;
		u.im = 0;
      	for (var j = 0; j < l1; j++) {
        	for (var i = j; i < n; i += l2) {
		        var i1 = i + l1;
		        //var t1 = mulComplex(u, X.get(i1) );
		        var t1re = u.re * X.re[i1] - u.im * X.im[i1]; // t1 = u * X[i1]
		        var t1im = u.im * X.re[i1] + u.re * X.im[i1];

		        X.re[i1] = X.re[i] - t1re;
		        X.im[i1] = X.im[i] - t1im;
		        	        
		        X.re[i] += t1re;
		        X.im[i] += t1im;
	        }

			u = mulComplex(u, c);
		}

		c.im = Math.sqrt((1.0 - c.re) / 2.0);		
		c.re = Math.sqrt((1.0 + c.re) / 2.0);
	}
	var isComplex = false;
	for(var i=0; i < n; i++) {
		X.re[i] /= n;
		X.im[i] /= n;
		if ( Math.abs(X.im[i]) > 1e-6 )
			isComplex = true;
	}
	if (isComplex)
		return X;
	else
		return X.re;
}

function dft(x) {
	// DFT of a real signal
	if ( typeof(x) == "number")
		return new Complex(x, 0); 
	
	const n = x.length;
	if ( n == 1) 
		return new Complex(x[0], 0); 
	else if ( Math.log2(n) % 1 == 0 )
		return fft(x);
	else {
		var X = new ComplexVector(n);
		var thet = 0.0;
		for ( var i=0; i < n; i++) {
			var theta = 0.0;
			for ( var t=0; t < n; t++)  {
				// theta = -2 pi i * t / n;
				X.re[i] += x[t] * Math.cos(theta);
				X.im[i] += x[t] * Math.sin(theta);
				theta += thet; 
			}
			thet -= 2*Math.PI / n;
		}
		return X;
	}
}
function idft(X) {
	// Only recovers real part 
	/*
importScripts("src/experimental/complex.js")
t = 0:512
x = sin(t)
X = dft(x)
plot(modulus(X))
s = idft(X)
plot(s)	
	*/
	if ( !(X instanceof ComplexVector) ) {
		if ( X instanceof Complex)
			return X.re;	
		else if (typeof(X) == "number")
			return X;
		else if ( X instanceof Float64Array)
			return idft(new ComplexVector(X, zeros(X.length), true)); 
		else
			return undefined;
	}
	const n = X.length;
	if ( n == 1) 
		return X.re[0];
	else if ( Math.log2(n) % 1 == 0 )
		return ifft(X);
	else {
		var x = new Float64Array(n);
		var thet = 0.0;
		for ( var t=0; t < n; t++) {
			var theta = 0.0;
			var re = 0.0;
			//var im = 0.0;
			for ( var i=0; i < n; i++)  {
				// theta = 2 pi i * t / n;
				re += X.re[i] * Math.cos(theta) - X.im[i] * Math.sin(theta);
				// im += X[i].im * Math.sin(theta) + X[i].re * Math.cos(theta); // not used for real signals
				theta += thet; 
			}
			x[t] = re / n;
			thet += 2*Math.PI / n;
		}
		return x;
	}
}

function spectrum(x) {
	if ( x instanceof Float64Array ) {
		return absComplex(dft(x));
	}
	else 
		return undefined;
}
/*
	Library for plotting functions 
	
	You need to include 
	
		 <canvas id="plotcanvas" width="600" height="300" style="border: 1px solid black;">>   </canvas> 
		 
	
	Usage:
	
		setScalePlot ( minX, maxX, Nsamples, scaleY)	// scaleY is a factor of scaleX
		
		plot( f [, color_index ] ) 

	To clear the plot: 
		clearPlot();
*/


//////////////////////////////
// Cross-browsers compatibility:
/*
	Chrome : turn off hardware acceleration to get mousemove events!
*/

/* Array.fill : 
if (!Array.prototype.fill) {
  Array.prototype.fill = function(value) {
  	if (this == null) {
      throw new TypeError("this is null or not defined");
    }
    if ( typeof( value ) == "object") 
    	throw new TypeError("Array.fill:: the value is not valid => only simple values allowed");
    
    
    var O = Object(this);
    for ( var i= 0; i < this.length; i++) {
    	O[i] = eval(value);
    }
    return O;	
  }

}

*/

////////////////////////////
// class Diagram
//
// functions take lengths in % of width and height
/////////////////////////////
function Diagram(canvasId) {
	if(typeof(canvasId) === 'undefined' ) 
		canvasId = "diagram";

	this.canvasId = canvasId; 
		
	this.shapes = new Array();
	this.selectedShape = -1; // for mousemove
	this.selectedShapes = new Array();	// for user
	
	this.mousexprev = -1;
	this.mouseyprev = -1;

	////// Cross browser support ////
	var ctx = document.getElementById(this.canvasId).getContext("2d");
	if ( !ctx.setLineDash ) {
		ctx.setLineDash = function () {};
	}
}

Diagram.prototype.rect = function (x,y,w, h, color, txt, txtcolor, opacity ) {
	if(typeof(opacity) === 'undefined')
		var opacity = 0.6;
	if(typeof(txtcolor) === 'undefined')
		var txtcolor = 0;
	if(typeof(txt) === 'undefined')
		var txt = "";
	if(typeof(color) === 'undefined')
		var color = 1;
	
	
	this.shapes.push( ["rect",  x, y, w, h, color, txt, txtcolor, opacity  ] ) ;
	
	this.redraw();
}
Diagram.prototype.circle = function (x,y,w, h, color, txt, txtcolor, opacity ) {
	if(typeof(opacity) === 'undefined')
		var opacity = 0.6;
	if(typeof(txtcolor) === 'undefined')
		var txtcolor = 0;
	if(typeof(txt) === 'undefined')
		var txt = "";
	if(typeof(color) === 'undefined')
		var color = 1;
	
	
	this.shapes.push( ["circle",  x, y, w, h, color, txt, txtcolor, opacity  ] ) ;
	
	this.redraw();
}
Diagram.prototype.image = function (x,y,w, h, imagename , txt, txtcolor, opacity) {
	if(typeof(opacity) === 'undefined')
		var opacity = 0.6;
	if(typeof(txtcolor) === 'undefined')
		var txtcolor = 0;
	if(typeof(txt) === 'undefined')
		var txt = "";
	
	var t = this;
	var imageIndex = this.shapes.length;
	var image = new Image() ;
	image.src = imagename;	
	image.onload = function() {		
		t.shapes[imageIndex][9] = true;
		t.redraw(); 
	}
 
	this.shapes.push( ["image", x,y,w,h,image, txt, txtcolor, opacity, false ] ); 
}

Diagram.prototype.redraw = function () {
	var canvas = document.getElementById(this.canvasId);
	var ctx = canvas.getContext("2d");
	ctx.clearRect(0,0,canvas.width, canvas.height);
	
	var n;
	var shape;
	var x;
	var y;
	var w;
	var h;
	var color;
	var txt;
	var txtcolor;
	var opacity;
	var res;
	
	// Draw shapes
	for ( n = 0; n < this.shapes.length; n++) {
		shape = this.shapes[n][0];
		x = this.shapes[n][1];
		y = this.shapes[n][2];
		w = this.shapes[n][3];
		h = this.shapes[n][4];
		color = this.shapes[n][5];
		txt = this.shapes[n][6];
		txtcolor = this.shapes[n][7];
		opacity = this.shapes[n][8];
		
		if ( shape == "rect" ) {

			setcolortransparent(ctx, color, opacity);
		
			
			var cornerSize = 15;
			ctx.beginPath();
			ctx.moveTo ( x * canvas.width , y * canvas.height + cornerSize);
			ctx.quadraticCurveTo( x * canvas.width, y * canvas.height, x * canvas.width + cornerSize, y * canvas.height );
			// quadraticCurve = bezier curve ( control poitn, destination)
			ctx.lineTo ( (x+w) * canvas.width - cornerSize, y * canvas.height);
			ctx.quadraticCurveTo( (x+w) * canvas.width , y * canvas.height, (x+w) * canvas.width, y * canvas.height + cornerSize);
			ctx.lineTo ( (x+w) * canvas.width , (y+h) * canvas.height - cornerSize);
			ctx.quadraticCurveTo( (x+w) * canvas.width, (y+h) * canvas.height, (x+w) * canvas.width - cornerSize, (y+h) * canvas.height );
			ctx.lineTo ( x * canvas.width + cornerSize , (y+h) * canvas.height);
			ctx.quadraticCurveTo( x * canvas.width, (y+h) * canvas.height, x * canvas.width , (y+h) * canvas.height - cornerSize );

			ctx.closePath();
			ctx.fill();
			
			//ctx.fillRect( x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height ) ;
	
			
			// deal with selection
			if ( n == this.selectedShape  || this.selectedShapes.indexOf( n ) >= 0 ) {
				setcolortransparent(ctx, 5, 0.3);
				ctx.fillRect( (x-0.005) * canvas.width, (y-0.005) * canvas.height, (w+0.01) * canvas.width, (h+0.01) * canvas.height ) ;
			}
	
		}
		else if ( shape == "circle" ) {
			setcolortransparent(ctx, color, opacity);
		
			ctx.beginPath();
			ctx.moveTo ( (x+w/2) * canvas.width , y * canvas.height);
			ctx.quadraticCurveTo( (x+w) * canvas.width, y * canvas.height, (x+w) * canvas.width, (y+h/2) * canvas.height );
			ctx.quadraticCurveTo( (x+w) * canvas.width, (y+h) * canvas.height, (x+w/2) * canvas.width, (y+h) * canvas.height );
			ctx.quadraticCurveTo( x * canvas.width, (y+h) * canvas.height, x * canvas.width, (y+h/2) * canvas.height );
			ctx.quadraticCurveTo( x * canvas.width, y * canvas.height, (x+w/2) * canvas.width, y * canvas.height );
			
			ctx.fill();
			
			// deal with selection
			if ( n == this.selectedShape  || this.selectedShapes.indexOf( n ) >= 0 ) {
				setcolortransparent(ctx, 5, 0.3);
				ctx.fillRect( (x-0.005) * canvas.width, (y-0.005) * canvas.height, (w+0.01) * canvas.width, (h+0.01) * canvas.height ) ;
			}
			
		}
				else if ( shape == "point" ) {
			setcolortransparent(ctx, color, opacity);
		
			ctx.beginPath();
			ctx.arc(x * canvas.width , y * canvas.height , w * canvas.width, 0, 2 * Math.PI , true);
			ctx.closePath();
				
			ctx.fill();
			
			// deal with selection
			if ( n == this.selectedShape  || this.selectedShapes.indexOf( n ) >= 0 ) {
				setcolortransparent(ctx, 5, 0.3);
				ctx.fillRect( (x-0.005) * canvas.width, (y-0.005) * canvas.height, (w+0.01) * canvas.width, (h+0.01) * canvas.height ) ;
			}
			
		}
		else if ( shape == "label" ) {
			setcolortransparent(ctx, color, opacity);
			var lbl = document.getElementById(this.shapes[n][9]);
			lbl.style.left = x * canvas.width;
			lbl.style.top = y * canvas.height;
			lbl.style.visibility = "visible"; 
			
		}
		else if ( shape == "arrow" ) {
			setcolortransparent(ctx, color, opacity);
					
			var arrowSize = 15;
			
			ctx.save();
			ctx.translate(x * canvas.width , y * canvas.height);
			ctx.rotate(Math.PI * (this.shapes[n][9] / 180) );
			
			ctx.beginPath();
			ctx.moveTo ( 0,0);
			ctx.lineTo ( (w) * canvas.width,0);
			ctx.lineTo ( (w) * canvas.width, 0 - arrowSize*0.3);
			ctx.lineTo ( (w) * canvas.width + arrowSize, ( h/2) * canvas.height);
			ctx.lineTo ( (w) * canvas.width, (h) * canvas.height + arrowSize*0.3);			
			ctx.lineTo ( (w) * canvas.width , (h) * canvas.height);
			ctx.lineTo ( 0 , (h) * canvas.height);
			
			ctx.closePath();
			ctx.fill();
			
			ctx.restore();
			
		}
		else if ( shape == "image" ) {
			if ( this.shapes[n][9] ) {
				// iamge is ready
				ctx.drawImage(this.shapes[n][5], x*canvas.width, y*canvas.height, w * canvas.width, h * canvas.height);			
				// deal with selection
				if ( n == this.selectedShape || this.selectedShapes.indexOf( n ) >= 0 ) {
					setcolortransparent(ctx, 3, 0.3);
					ctx.fillRect( (x-0.005) * canvas.width, (y-0.005) * canvas.height, (w+0.01) * canvas.width, (h+0.01) * canvas.height ) ;
				}
			}
		}
		 
		if( txt != "" ) { 
			var words = txt.split("*");
			ctx.textAlign = "center";	// center of text appear at x position
			var txtsize = Math.floor(50 * w) ;
			ctx.font = txtsize + "pt sans-serif";
			setcolor(ctx, txtcolor);
		
			if ( words.length == 1 ) {
				ctx.fillText( txt, (x + w/2) * canvas.width , (y + h/2) * canvas.height ) ;
			}
			else { 
				for (var i = 0; i< words.length; i++) {
					ctx.fillText( words[i], (x + w/2) * canvas.width , (y + h/2 ) * canvas.height - (words.length/2 - i - 0.5)* (1.5 * txtsize)) ;
				}
			}
		}
		
	}
	
}

Diagram.prototype.mouseselect = function (event) {
	var canvas= document.getElementById(this.canvasId);
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;	// mouse coordinates relative to plot
	var y = event.clientY - rect.top;
	
	if ( Math.abs(x - this.mousexprev) >= 1 || Math.abs(y - this.mouseyprev) >= 1 ) {
		this.mousexprev = x;
		this.mouseyprev = y;
		
		// Find shape... starting from last one added which is on top of others...
		var i = this.shapes.length - 1;
		while ( i >= 0 && this.isInShape(x,y,this.shapes[i] ) == false )
			i--;
	
		if ( i >= 0 ) {
			if ( i != this.selectedShape ) {	
				// new hit on shape i 
				this.selectedShape = i;
				this.redraw();
		
				this.onSelect();
			}
		}	
		else if ( this.selectedShape >= 0 ) {
			this.onDeselect();
			this.selectedShape = -1;
			this.redraw();
		}
	}
}

Diagram.prototype.isInShape = function (x, y, shape) {
	var canvas = document.getElementById(this.canvasId);
	if(shape[0] == "rect") {
		if ( x > shape[1] * canvas.width && x < ( shape[1] + shape[3] ) * canvas.width && y > shape[2] * canvas.height && y < (shape[2]+shape[4]) * canvas.height)
			return true;
		else 
			return false;
	}
	else if ( shape[0] == "circle" ) {
		if ( x > shape[1] * canvas.width && x < ( shape[1] + shape[3] ) * canvas.width && y > shape[2] * canvas.height && y < (shape[2]+shape[4]) * canvas.height)
			return true;
		else 
			return false;
	}
	else if ( shape[0] == "arrow" ) {
		return false;
	}
	else 
		return false;
}

Diagram.prototype.onSelect = function () {
	// empty selection event handler
}

Diagram.prototype.onDeselect = function () {
	// empty selection event handler
}

Diagram.prototype.select = function ( n ) {
	if ( typeof(n) == "number" ) {
		if ( this.selectedShapes.indexOf( n ) < 0 )  {
			this.selectedShapes.push ( n );	
			this.redraw();
		}
	}
	else {
		for ( var i=0; i < n.length; i++ ) {
			if ( this.selectedShapes.indexOf( n[i] ) < 0 )  {
				this.selectedShapes.push ( n[i] );					
			}
		}
		this.redraw();
	}
}
Diagram.prototype.deselect = function ( n ) {
	if ( typeof(n) == "number" ) {
		var idx = this.selectedShapes.indexOf( n );
		if ( idx >= 0 ) {
			this.selectedShapes.splice ( idx , 1 );	
			this.redraw();
		}
	}
	else {
		var idx;
		for ( var i=0; i < n.length; i++ ) {
			idx = this.selectedShapes.indexOf( n[i] );
			if ( idx >= 0 ) {
				this.selectedShapes.splice ( idx , 1 );	
			}
		}
		this.redraw();
	}
}
Diagram.prototype.selectall = function ( n ) {
	for( var i = 0; i < this.shapes.length; i++)
		this.selectedShapes.push( i);
	this.redraw();
}
Diagram.prototype.deselectall = function ( ) {
	while (this.selectedShapes.length > 0)
		this.selectedShapes.pop();
	this.redraw();
	
}

////////////////////////////
// Define Object class "Plot" to be assigned to a canvas
/////////////////////////////
function Plot(canvasId) {
	if(typeof(canvasId) === 'undefined' ) 
		canvasId = "plotcanvas";

	this.canvasId = canvasId; 
		
	this.minX = 0;
	this.maxX = 10;
	this.Nsamples = 1000;
	this.scaleX = 1;
	this.scaleY = 1;
	this.minY = 0;
	this.maxY = 1.5;	
	 
	this.fcts = new Array();
	this.lines= new Array();
	this.areas= new Array();
	this.points= new Array(); 	
	this.paths= new Array();

	this.legend = "topright";

	var canvas = document.getElementById(this.canvasId);
	this.buffer = document.createElement('canvas');
	this.buffer.width  = canvas.width;
	this.buffer.height = canvas.height;
	
	this.viewX = 0;
	this.viewY = 0;
	
	////// Cross browser support ////
	//var ctx = document.getElementById(this.canvasId).getContext("2d");
	var ctx = this.buffer.getContext("2d");
	if ( !ctx.setLineDash ) {
		ctx.setLineDash = function () {};
	}
}


Plot.prototype.addPoint = function(x,y,color_idx,radius, opacity) {
	if(typeof(color_idx) === 'undefined')
		color_idx = 0;
	if(typeof(radius) === 'undefined')
		radius = 5;
	if(typeof(opacity) === 'undefined')
		opacity = 1.1;
		
	this.points.push([x,y,color_idx,radius,opacity] );
}

Plot.prototype.plotAxis = function() {
	//var canvas = document.getElementById(this.canvasId);
	var canvas = this.buffer; 
  if (canvas.getContext) {
	var ctx = canvas.getContext("2d");
	ctx.fillStyle="white";
	ctx.fillRect (0,0 , canvas.width, canvas.height);
	ctx.strokeStyle = "black";			
	
	if (this.minY < 0 && this.maxY > 0) {
		// X-axis		
		var y0 = canvas.height - (-this.minY * this.scaleY);
		ctx.beginPath();
		ctx.moveTo(0, y0);
		ctx.lineTo(canvas.width, y0 );
		ctx.closePath();
		ctx.stroke();
		
		// ticks		 
		var tickspace = Math.ceil( (this.maxX - this.minX) / 10);
		for (var x = -tickspace; x>this.minX; x -= tickspace ) {
			var xx = (x - this.minX) * this.scaleX ;
			ctx.beginPath();
			ctx.moveTo(xx,y0 - 5 );
			ctx.lineTo(xx, y0 + 5 );
			ctx.stroke();		
		}
		for (var x = tickspace; x < this.maxX ; x+=tickspace ) {		
			var xx = (x - this.minX) * this.scaleX ;
			ctx.beginPath();
			ctx.moveTo(xx,y0 - 5 );
			ctx.lineTo(xx, y0 + 5 );
			ctx.stroke();		
		}
	}
	
	if (this.minX < 0 && this.maxX > 0) {
		// Y-axis
		var x0 = -this.minX * this.scaleX;
		ctx.beginPath();
		ctx.moveTo(x0 ,0);
		ctx.lineTo(x0 ,canvas.height);
		ctx.closePath();
		ctx.stroke();
		
		// ticks		 
		var tickspace = Math.ceil( (this.maxY - this.minY) / 10);
		for (var y = -tickspace; y>this.minY; y -= tickspace ) {
			var yy = (y - this.minY) * this.scaleY ;
			ctx.beginPath();
			ctx.moveTo(x0 -5 ,canvas.height-yy );
			ctx.lineTo(x0 + 5, canvas.height-yy );
			ctx.stroke();		
		}
		for (var y = tickspace; y<this.maxY; y += tickspace ) {
			var yy = (y - this.minY) * this.scaleY ;
			ctx.beginPath();
			ctx.moveTo(x0 -5 , canvas.height-yy );
			ctx.lineTo(x0 + 5, canvas.height- yy );
			ctx.stroke();	
		}		
	}
  }
}


Plot.prototype.replot = function (  ) {
	
	var x1;
	var x2;
	var y1;
	var y2;
	var opacity;
	var radius;
	var x;
	var y;
	
	var f;
	var legend;
	var color_idx;
	var dashed;
	var fillareaTo;
	var nlegend = 0;
	var res;

	var canvas = this.buffer;  
//	var canvas=document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		this.plotAxis();
		
		// use shadow but not on axis
		ctx.shadowColor = '#999';
      	ctx.shadowBlur = 3;
      	ctx.shadowOffsetX = 3;
      	ctx.shadowOffsetY = 3;
      
		
		const minX = this.minX;
		const minY = this.minY;		
		const scaleX = this.scaleX;
		const scaleY = this.scaleY;
		const height = canvas.height;
		
		var xplot = function (x) {
			return (x-minX ) * scaleX ;
		}
		var yplot = function (y) {
			return height - (y-minY)*scaleY ;
		}


	
		// Plot areas
		for (var n=0; n < this.areas.length; n++)	{
			res = this.areas[n];
			x1 = res[0];
			y1 = res[1];
			x2 = res[2];
			y2 = res[3];
			color_idx = res[4];
			opacity = res[5];
		
			if(color_idx == -1) {
				color_idx = n+1;
			}
			setcolortransparent(ctx, color_idx, opacity);
			var rectwidth = Math.abs(x2-x1);
			var rectheight = Math.abs(y2 -y1);
			var rectx = Math.min(x1,x2);
			var recty = Math.max(y1,y2);
			ctx.fillRect(( rectx-this.minX ) * this.scaleX , canvas.height - ( recty - this.minY) * this.scaleY , rectwidth * this.scaleX ,  rectheight * this.scaleY );

		}

		// Plot lines
		ctx.lineWidth="3";
		var cp = Infinity;
		for (var n=0; n < this.lines.length; n++)	{
			res = this.lines[n];
			
			if ( ( res[0] >= this.minX && res[0] <= this.maxX && res[1] >= this.minY && res[1] <= this.maxY ) //start in plot
				|| (( res[2] >= this.minX && res[2] <= this.maxX && res[3] >= this.minY && res[3] <= this.maxY ))  // end in plot
				|| ( res[0] < this.minX && res[2] > this.maxX && ((res[1] >= this.minY && res[1] <= this.maxY) || (res[3] >= this.minY && res[3] <= this.maxY))  )	// overflow on x axis but y inside plot
				|| ( res[2] < this.minX && 0 > this.maxX && ((res[1] >= this.minY && res[1] <= this.maxY) || (res[3] >= this.minY && res[3] <= this.maxY))  )	
				|| ( res[1] < this.minY && res[3] > this.maxY && ((res[0] >= this.minX && res[0] <= this.maxY) || (res[2] >= this.minX && res[2] <= this.maxX))  )// y-axis	
				|| ( res[3] < this.minY && res[1] > this.maxY && ((res[0] >= this.minX && res[0] <= this.maxX) || (res[2] >= this.minX && res[2] <= this.maxX))  )			
				) {
			
				x1 = xplot(res[0]);
				y1 = yplot(res[1]);
				x2 = xplot(res[2]);
				y2 = yplot(res[3]);

				if ( Math.abs(x2-x1)>1 || Math.abs(y2-y1) > 1 )  {
					color_idx = res[4];
					dashed = res[5];
	
					if(color_idx == -1) {
						color_idx = n+1;
					}
					
					if ( color_idx != cp )
						setcolor(ctx, color_idx);
		
					if (dashed) {
						ctx.setLineDash([5]);
						ctx.lineWidth="1";
					}
					
					ctx.beginPath();		
					ctx.moveTo(x1 , y1);
					ctx.lineTo(x2 ,y2);
					ctx.stroke();
					
					if (dashed) {
						ctx.setLineDash([1, 0]);
						ctx.lineWidth="3";
					}
					
					cp = color_idx;
				}
			}
		}	
		ctx.lineWidth="1";
		
		// Plot points 
		var xp = Infinity;
		var yp = Infinity;
		var cp = Infinity;
		var op = -1;
		for (var n=0; n < this.points.length; n++)	{
			res = this.points[n];
			
			if ( res[0] >= this.minX && res[0] <= this.maxX && res[1] >= this.minY && res[1] <= this.maxY) {
				
				x = xplot(res[0]);
				y = yplot(res[1]);
				if ( Math.abs(x-xp)>1 || Math.abs(y-yp) > 1  ) {
					color_idx = res[2];
					radius = res[3];
					opacity = res[4];
	
					if ( op != opacity || cp != color_idx) {
						if ( opacity > 1.0 ) 
							setcolor(ctx, color_idx);
						else 	
							setcolortransparent(ctx, color_idx, opacity);
					}
					
					ctx.beginPath();
					ctx.arc( x , y , radius, 0, 2 * Math.PI , true);
					ctx.closePath();
					ctx.fill();
				
					xp = x;
					yp = y;
					cp = color_idx;
					op = opacity;
				}
			}
		}
	
		// Plot paths (sets of point-lines with all the same style, e.g.,  for lalolab functions)
		for (var n=0; n < this.paths.length; n++) {
			res = this.paths[n];
			color_idx = res[1];
			radius = res[2];
			opacity = res[3];
			dashed = res[4];
			var marker = (opacity > 0 );
			if ( opacity > 1.0 ) 
				setcolor(ctx, color_idx);
			else 	
				setcolortransparent(ctx, color_idx, opacity);
		
			if (dashed) {
				ctx.setLineDash([5]);
				ctx.lineWidth="1";
			}
			else{
				ctx.lineWidth="3";
			}
			ctx.beginPath();

			x = xplot(res[0][0][0]);
			y = yplot(res[0][0][1]);

			ctx.arc( x , y , radius, 0, 2 * Math.PI , true);	
			ctx.moveTo(x,y);				

			for ( var i=1; i < res[0].length; i++) {
				x = xplot(res[0][i][0]);
				y = yplot(res[0][i][1]);
		
				if ( x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height ) {
					if( marker )
						ctx.arc( x , y , radius, 0, 2 * Math.PI , true);	
					ctx.lineTo(x,y);				
				}
			}
			//ctx.closePath();
			ctx.stroke();
			//ctx.fill();
			
			ctx.setLineDash([1, 0]);
			ctx.lineWidth="1";
		}
		
			// Plot functions
		for(var n=0; n < this.fcts.length; n++)	{

			res = this.fcts[n];
			f = res[0];
			legend = res[1];
			color_idx = res[2];
			dashed = res[3];
			fillareaTo = res[4];
		
	
			if(color_idx == -1) {
				color_idx = n+1;
			}
		
			setcolor(ctx, color_idx);

			if (dashed) {
				ctx.setLineDash([5]);
				ctx.lineWidth="1";
			}
			else{
				ctx.lineWidth="3";
			}
	

		
			if ( fillareaTo !== false ) {
				ctx.beginPath();
				ctx.moveTo(canvas.width, canvas.height - (fillareaTo  - this.minY)* this.scaleY);
				ctx.lineTo(0, canvas.height - (fillareaTo  - this.minY)* this.scaleY );
				//ctx.moveTo(0,canvas.height/2);
			}
			else {
				ctx.moveTo(0,canvas.height/2);		
				ctx.beginPath();
			}

			for(var x=this.minX; x < this.maxX; x += (this.maxX-this.minX) / this.Nsamples ) {
				var y = f(x);
				var yp = canvas.height - ( y - this.minY) * this.scaleY ;
				if (yp >= 0 && yp <= canvas.height) 
					ctx.lineTo(xplot(x) , yp );
				else
					ctx.moveTo(xplot(x) , yp);
	
			}
			ctx.stroke();
			if ( fillareaTo !== false ) {
				ctx.closePath();
				setcolortransparent(ctx, color_idx, 0.5); 
				ctx.fill();
			}
			ctx.setLineDash([1, 0]);
			ctx.lineWidth="1";
		
			// Add legend: 
			if ( this.legend != "" && legend != "") {
				setcolor(ctx, color_idx); 
				if ( this.legend == "topright") 
					ctx.strokeText(legend, canvas.width - 100, 20*(nlegend+1));
				else if ( this.legend == "topleft") 
					ctx.strokeText(legend, 10, 20*(nlegend+1));
				else if ( this.legend == "bottomright") 
					ctx.strokeText(legend, canvas.width - 100, canvas.height - 20*(nlegend+1));
				else if ( this.legend == "bottomleft") 
					ctx.strokeText(legend,10, canvas.height - 20*(nlegend+1));
			
				nlegend++;
			}

		}
	}
	
	// Copy buffer to viewport
	var viewcanvas = document.getElementById(this.canvasId);
	var ctx = viewcanvas.getContext("2d");
	ctx.drawImage(this.buffer, this.viewX, this.viewY, viewcanvas.width,viewcanvas.height,0,0, viewcanvas.width,viewcanvas.height);
}


Plot.prototype.plot = function ( f, legend, color_idx, dashed , fillareaTo ) {
	if (typeof(fillareaTo) === 'undefined')
		fillareaTo = false;
 
	if (typeof(dashed) === 'undefined')
		dashed = false; 
	if (typeof(color_idx) === 'undefined')
		color_idx = -1; 
	if (typeof(legend) === 'undefined') {
		if (dashed)
			legend = "";
		else
			legend = f.name; 
	}
	this.fcts.push([f, legend, color_idx,dashed, fillareaTo]);
	this.replot();
}


Plot.prototype.plot_line = function ( x1,y1,x2,y2, color_idx, dashed  ) {
	if (typeof(dashed) === 'undefined')
		dashed = false; 
	if (typeof(color_idx) === 'undefined')
		color_idx = -1; 
	this.lines.push([x1,y1,x2,y2, color_idx,dashed]);
	//this.replot();
}
Plot.prototype.plot_area = function ( x1,y1,x2,y2, color_idx, opacity  ) {
	if (typeof(opacity) === 'undefined')
		opacity = 1.0; 
	if (typeof(color_idx) === 'undefined')
		color_idx = -1; 
	this.areas.push([x1,y1,x2,y2, color_idx,opacity]);
	this.replot();
}
Plot.prototype.plot_path = function ( x,y, color_idx, radius, opacity, dashed  ) {
	if (typeof(dashed) === 'undefined')
		var dashed = false; 
	if (typeof(color_idx) === 'undefined')
		var color_idx = -1; 
	if (typeof(opacity) === 'undefined')
		var opacity = 1;
	if (typeof(radius) === 'undefined')
		var radius = 5;
	this.paths.push([x,y, color_idx,radius, opacity, dashed]);
	//this.replot();
}

Plot.prototype.clear = function () {
 var canvas = document.getElementById(this.canvasId);
  if (canvas.getContext) {
	var ctx = canvas.getContext("2d");
	
	this.plotAxis();
	
	// Empty list of functions to plot:
	while(this.fcts.length > 0) {
    	this.fcts.pop();
	}
	
	while(this.lines.length > 0) {
    	this.lines.pop();
	}
	
	while(this.areas.length > 0) {
    	this.areas.pop();
	}
	while(this.points.length > 0) {
    	this.points.pop();
	}
  }
}

Plot.prototype.setScalePlot = function  ( minX, maxX, Nsamples, scaleY) {
	this.minX = minX;
	this.maxX = maxX;
	this.Nsamples = Nsamples;
	
	var canvas = document.getElementById(this.canvasId);
	this.scaleX = canvas.width / (maxX - minX) ; 
	this.scaleY = this.scaleX * scaleY;
		
	this.maxY = (canvas.height/2) / this.scaleY ;
	this.minY = -this.maxY;// centered view 
	
	//this.clear();
	
	this.originalminX = this.minX;
	this.originalmaxX = this.maxX;
	this.originalminY = this.minY;
	this.originalmaxY = this.maxY;	
}

Plot.prototype.view = function  ( minX, maxX, minY, maxY) {
	this.minX = minX;
	this.maxX = maxX;
	this.minY = minY;
	this.maxY = maxY;
	
	var canvas = this.buffer;
	this.scaleX = canvas.width / (maxX - minX) ; 
	this.scaleY = canvas.height / (maxY - minY) ;
	this.replot(); 	
}

Plot.prototype.translate = function  ( dx, dy ) {
	var canvas = document.getElementById(this.canvasId);
	var newX = this.viewX - dx;
	var newY = this.viewY - dy;
	if ( newX >= 0 && newX < this.buffer.width - canvas.width && newY >= 0 && newY < this.buffer.height - canvas.height ) {
	
		this.viewX = newX;
		this.viewY = newY;
	
		var ctx = canvas.getContext("2d");
		ctx.clearRect (0, 0 , canvas.width, canvas.height);
		ctx.drawImage(this.buffer, this.viewX, this.viewY, canvas.width,canvas.height,0,0, canvas.width,canvas.height);
	}
}
Plot.prototype.zoom = function  ( zx, zy, x, y) {
	var viewcanvas = document.getElementById(this.canvasId);
	var canvas = this.buffer;
	
	if ( zy > 0 )
		canvas.height *= zy; 
	else
		canvas.height = viewcanvas.height; 
	if ( zx > 0 )
		canvas.width *= zx;
	else
		canvas.width = viewcanvas.width; 
		
	// do not zoom out further than original 
	if ( canvas.width < viewcanvas.width )
		canvas.width = viewcanvas.width; 
	if( canvas.height < viewcanvas.height )
		canvas.height = viewcanvas.height;

	// do not zoo in too much
	if ( canvas.width > 10000)
		canvas.width = 10000; 
	if( canvas.height > 10000 )
		canvas.height > 10000;
	
	var sx = this.scaleX;
	var sy = this.scaleY;
	this.scaleX = canvas.width / (this.maxX - this.minX) ; 
	this.scaleY = canvas.height / (this.maxY - this.minY) ;

	// zoom center is (x,y)
	if ( arguments.length < 4 ) {
		var x = viewcanvas.width/2;
		var y = viewcanvas.height/2;// by default viewport center is fixed during zoom
	}
	
	this.viewX = ((this.viewX + x) * this.scaleX / sx) - x;
	this.viewY = ((this.viewY + y) * this.scaleY / sy) - y;	
	if ( this.viewX < 0 )
		this.viewX = 0;
	if (this.viewY < 0 )
		this.viewY = 0; 
	if ( this.viewX > canvas.width - viewcanvas.width ) 
		this.viewX =  canvas.width - viewcanvas.width ;
	if ( this.viewY > canvas.height - viewcanvas.height ) 
		this.viewY =  canvas.height - viewcanvas.height ;

	if( sx != this.scaleX || sy != this.scaleY )
		this.replot(); 
}
Plot.prototype.resetzoom = function  ( ) {
	var viewcanvas = document.getElementById(this.canvasId);
	var canvas = this.buffer;
	this.viewX = 0;
	this.viewY = 0;
	canvas.height = viewcanvas.height; 
	canvas.width = viewcanvas.width; 
	this.scaleX = viewcanvas.width / (this.maxX - this.minX) ; 
	this.scaleY = viewcanvas.height / (this.maxY - this.minY) ;
	this.replot(); 	
}

Plot.prototype.pick_point = function(e) {
	if(e.button == 0) {
		e.preventDefault();	
		var canvas = document.getElementById(this.canvasId);
	
		var rect = canvas.getBoundingClientRect();

		var xmouse = e.clientX - rect.left;	// mouse coordinates relative to plot
		var ymouse = e.clientY - rect.top;

		var x = xmouse / this.scaleX + this.minX;
		var y = (canvas.height  - ymouse ) / this.scaleY + this.minY;
		
		return [x,y];
	}
	else 
		return false; // not correct button
}


Plot.prototype.proximityX = function (x, x0, epsilon) {
	if (typeof(epsilon) === 'undefined')
		epsilon = (this.maxX - this.minX) / 20;
		
	return ( Math.abs(x - x0) < epsilon ) ;
}


Plot.prototype.plotmathjax = function(stringindex, x, y) {
			
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");

		var label = document.getElementById("jaxstring"+stringindex);
		label.style.top = canvas.height/2 - ( y * this.scaleY ) + canvas.offsetTop;
		label.style.left = (x - this.minX) * this.scaleX + canvas.offsetLeft;	
		label.style.visibility = "visible"; 
	}
}
	 
Plot.prototype.jpeg = function() {
	var canvas = document.getElementById(this.canvasId);
	
	var image = canvas.toDataURL("image/jpeg");
	
	document.location.href = image.replace("image/jpeg", "image/octet-stream");
}


Plot.prototype.zoomoriginal = function () {
	this.view(this.originalminX,this.originalmaxX,this.originalminY,this.originalmaxY);	
}

Plot.prototype.mousestartmove = function ( e ) {
	var canvas = document.getElementById(this.canvasId);
	if ( e.button == 0 ) {
		this.MOVING = true;
		var rect = canvas.getBoundingClientRect();
		this.xprev = e.clientX - rect.left;	// mouse coordinates relative to plot
		this.yprev = e.clientY - rect.top;
	}
	else {
		this.MOVING = false;
	}
}
Plot.prototype.mousestopmove = function ( e ) {
	this.MOVING = false;
}
Plot.prototype.mouseposition = function ( e ) {

	var canvas = document.getElementById(this.canvasId);
	var rect = canvas.getBoundingClientRect();

	var xmouse = e.clientX - rect.left;	
	var ymouse = e.clientY - rect.top;

	if ( this.MOVING ) {
		var dx = this.xprev - xmouse ;
		var dy = ymouse - this.yprev;
		if ( Math.abs( dx ) > 1 || Math.abs( dy ) > 1 ) {			
			//this.view(this.minX+dx/this.scaleX,this.maxX+dx/this.scaleX, this.minY+dy/this.scaleY, this.maxY+dy/this.scaleY);
			this.translate(dx, dy);
		}
		this.xprev = xmouse;
		this.yprev = ymouse;		
	}
	else {		
		var x = xmouse / this.scaleX + this.minX;
		var y = (canvas.height  - ymouse ) / this.scaleY + this.minY;	
		return "x = " + x.toFixed(3) + ", y = " + y.toFixed(3);	
	}
}



////////////////////////////
// Define Object class "ColorPlot" for (x,y) plots with z giving the point color
/////////////////////////////
function ColorPlot(canvasId) {
	if(typeof(canvasId) === 'undefined' ) 
		canvasId = "plotcanvas";

	this.canvasId = canvasId; 
		
	this.minX = 0;
	this.maxX = 10;
	this.scaleX = 1;
	this.scaleY = 1;
	this.minY = 0;
	this.maxY = 1.5;	
	this.minZ = 0;
	this.maxZ = 1;
		 
	this.x = new Array();
	this.y= new Array();
	this.z= new Array();
	
	this.cmap = this.colormap();
	
	var canvas = document.getElementById(this.canvasId);
	this.buffer = document.createElement('canvas');
	this.buffer.width  = canvas.width;
	this.buffer.height = canvas.height;
	
	this.viewX = 0;
	this.viewY = 0;

}

ColorPlot.prototype.colormap = function (cmapname) {
	switch(cmapname) {
	
	default:
    var cmap = [
		[0, 0, 143],
		[0, 0, 159],
		[0, 0, 175],
		[0, 0, 191],
		[0, 0, 207],
		[0, 0, 223],
		[0, 0, 239],
		[0, 0, 255],
		[0, 15, 255],
		[0, 31, 255],
		[0, 47, 255],
		[0, 63, 255],
		[0, 79, 255],
		[0, 95, 255],
		[0, 111, 255],
		[0, 127, 255],
		[0, 143, 255],
		[0, 159, 255],
		[0, 175, 255],
		[0, 191, 255],
		[0, 207, 255],
		[0, 223, 255],
		[0, 239, 255],
		[0, 255, 255],
		[15, 255, 239],
		[31, 255, 223],
		[47, 255, 207],
		[63, 255, 191],
		[79, 255, 175],
		[95, 255, 159],
		[111, 255, 143],
		[127, 255, 127],
		[143, 255, 111],
		[159, 255, 95],
		[175, 255, 79],
		[191, 255, 63],
		[207, 255, 47],
		[223, 255, 31],
		[239, 255, 15],
		[255, 255, 0],
		[255, 239, 0],
		[255, 223, 0],
		[255, 207, 0],
		[255, 191, 0],
		[255, 175, 0],
		[255, 159, 0],
		[255, 143, 0],
		[255, 127, 0],
		[255, 111, 0],
		[255, 95, 0],
		[255, 79, 0],
		[255, 63, 0],
		[255, 47, 0],
		[255, 31, 0],
		[255, 15, 0],
		[255, 0, 0],
		[239, 0, 0],
		[223, 0, 0],
		[207, 0, 0],
		[191, 0, 0],
		[175, 0, 0],
		[159, 0, 0],
		[143, 0, 0],
		[127, 0, 0]];
	break;
	}
	return cmap;
}
ColorPlot.prototype.addPoint = function(x,y,z) {
	this.x.push(x);
	this.y.push(y);
	this.z.push(z);
}

ColorPlot.prototype.plotAxis = function() {
	var canvas = this.buffer;	
  if (canvas.getContext) {
	var ctx = canvas.getContext("2d");
	ctx.fillStyle="white";
	ctx.fillRect (0,0 , canvas.width, canvas.height);
	ctx.strokeStyle = "black";			
	
	if (this.minY < 0 && this.maxY > 0) {
		// X-axis		
		var y0 = canvas.height - (-this.minY * this.scaleY);
		ctx.beginPath();
		ctx.moveTo(0, y0);
		ctx.lineTo(canvas.width, y0 );
		ctx.closePath();
		ctx.stroke();
		
		// ticks		
		var tickspace = Math.ceil( (this.maxX - this.minX) / 10);
		for (var x = -tickspace; x>this.minX; x -= tickspace ) {
			var xx = (x - this.minX) * this.scaleX ;
			ctx.beginPath();
			ctx.moveTo(xx,y0 - 5 );
			ctx.lineTo(xx, y0 + 5 );
			ctx.stroke();		
		}
		for (var x = tickspace; x < this.maxX ; x+=tickspace ) {		
			var xx = (x - this.minX) * this.scaleX ;
			ctx.beginPath();
			ctx.moveTo(xx,y0 - 5 );
			ctx.lineTo(xx, y0 + 5 );
			ctx.stroke();		
		}
	}
	
	if (this.minX < 0 && this.maxX > 0) {
		// Y-axis
		var x0 = -this.minX * this.scaleX;
		ctx.beginPath();
		ctx.moveTo(x0 ,0);
		ctx.lineTo(x0 ,canvas.height);
		ctx.closePath();
		ctx.stroke();
		
		// ticks
		for (var y = Math.ceil(this.minY); y < this.maxY; y++ ) {
			var yy = canvas.height - (y -this.minY) * this.scaleY;
			ctx.beginPath();
			ctx.moveTo(x0-5,yy);
			ctx.lineTo(x0+5,yy);
			ctx.stroke();		
		}
	}
  }
}

ColorPlot.prototype.replot = function (  ) {
	var x,y,z;
	var canvas=this.buffer;
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");

		this.plotAxis();
	  
	  	// use shadow but not on axis
		ctx.shadowColor = '#999';
      	ctx.shadowBlur = 3;
      	ctx.shadowOffsetX = 3;
      	ctx.shadowOffsetY = 3;
      
		// Plot points 
		var xp = Infinity;
		var yp = Infinity;
		var zp = Infinity;		
		for (var i=0; i < this.x.length; i++)	{
	
			if ( this.x[i] >= this.minX && this.x[i] <= this.maxX && this.y[i] >= this.minY && this.y[i] <= this.maxY) {
				
				x = (this.x[i]-this.minX ) * this.scaleX ;
				y =  canvas.height - (this.y[i] - this.minY) * this.scaleY ;
				z = Math.floor( (this.z[i] - this.minZ) * this.scaleZ);
				if ( z >= this.cmap.length )
					z = this.cmap.length-1;
				if ( z < 0)
					z = 0;
				if ( Math.abs(x-xp)>1 || Math.abs(y-yp) > 1 || z != zp ) {

					if ( z != zp )
						ctx.fillStyle = "rgb(" + this.cmap[z][0] + "," + this.cmap[z][1] + "," + this.cmap[z][2]+ ")";			

					ctx.beginPath();
					ctx.arc( x , y , 5, 0, 2 * Math.PI , true);
					ctx.closePath();
					ctx.fill();		
			
					zp = z;		
					xp = x;
					yp = y;
				}
			}
		}
	
	}
	
	// Copy buffer to viewport
	var viewcanvas = document.getElementById(this.canvasId);
	var ctx = viewcanvas.getContext("2d");
	ctx.drawImage(this.buffer, this.viewX, this.viewY, viewcanvas.width,viewcanvas.height,0,0, viewcanvas.width,viewcanvas.height);
}

ColorPlot.prototype.clear = function () {
	this.plotAxis();
	this.x = new Array();
	this.y = new Array();
	this.z = new Array();
}

ColorPlot.prototype.setScale = function  ( minX, maxX, minY, maxY, minZ, maxZ) {
	this.minX = minX;
	this.maxX = maxX;
	this.minY = minY;
	this.maxY = maxY;
	this.minZ = minZ;
	this.maxZ = maxZ;
	
	var canvas = document.getElementById(this.canvasId);
	this.scaleX = canvas.width / (maxX - minX) ; 
	this.scaleY = canvas.height / (maxY - minY);
	this.scaleZ = this.cmap.length / (maxZ - minZ) ;
	
	//this.clear();
	
	this.originalminX = this.minX;
	this.originalmaxX = this.maxX;
	this.originalminY = this.minY;
	this.originalmaxY = this.maxY;	
}

ColorPlot.prototype.view = function  ( minX, maxX, minY, maxY) {
	this.minX = minX;
	this.maxX = maxX;
	this.minY = minY;
	this.maxY = maxY;
	
	var canvas = this.buffer;
	this.scaleX = canvas.width / (maxX - minX) ; 
	this.scaleY = canvas.height / (maxY - minY) ;
	this.replot(); 	
}

ColorPlot.prototype.translate = function  ( dx, dy ) {
	var canvas = document.getElementById(this.canvasId);
	var newX = this.viewX - dx;
	var newY = this.viewY - dy;
	if ( newX >= 0 && newX < this.buffer.width - canvas.width && newY >= 0 && newY < this.buffer.height - canvas.height ) {
	
		this.viewX = newX;
		this.viewY = newY;
	
		var ctx = canvas.getContext("2d");
		ctx.clearRect (0, 0 , canvas.width, canvas.height);
		ctx.drawImage(this.buffer, this.viewX, this.viewY, canvas.width,canvas.height,0,0, canvas.width,canvas.height);
	}
}
ColorPlot.prototype.zoom = function  ( zx, zy, x, y) {
	var viewcanvas = document.getElementById(this.canvasId);
	var canvas = this.buffer;
	
	if ( zy > 0 )
		canvas.height *= zy; 
	else
		canvas.height = viewcanvas.height; 
	if ( zx > 0 )
		canvas.width *= zx;
	else
		canvas.width = viewcanvas.width; 
		
	// do not zoom out further than original 
	if ( canvas.width < viewcanvas.width )
		canvas.width = viewcanvas.width; 
	if( canvas.height < viewcanvas.height )
		canvas.height = viewcanvas.height;

	// do not zoo in too much
	if ( canvas.width > 10000)
		canvas.width = 10000; 
	if( canvas.height > 10000 )
		canvas.height > 10000;
	
	var sx = this.scaleX;
	var sy = this.scaleY;
	this.scaleX = canvas.width / (this.maxX - this.minX) ; 
	this.scaleY = canvas.height / (this.maxY - this.minY) ;

	// zoom center is (x,y)
	if ( arguments.length < 4 ) {
		var x = viewcanvas.width/2;
		var y = viewcanvas.height/2;// by default viewport center is fixed during zoom
	}
	
	this.viewX = ((this.viewX + x) * this.scaleX / sx) - x;
	this.viewY = ((this.viewY + y) * this.scaleY / sy) - y;	
	if ( this.viewX < 0 )
		this.viewX = 0;
	if (this.viewY < 0 )
		this.viewY = 0; 
	if ( this.viewX > canvas.width - viewcanvas.width ) 
		this.viewX =  canvas.width - viewcanvas.width ;
	if ( this.viewY > canvas.height - viewcanvas.height ) 
		this.viewY =  canvas.height - viewcanvas.height ;

	if( sx != this.scaleX || sy != this.scaleY )
		this.replot(); 
}
ColorPlot.prototype.resetzoom = function  ( ) {
	var viewcanvas = document.getElementById(this.canvasId);
	var canvas = this.buffer;
	this.viewX = 0;
	this.viewY = 0;
	canvas.height = viewcanvas.height; 
	canvas.width = viewcanvas.width; 
	this.scaleX = viewcanvas.width / (this.maxX - this.minX) ; 
	this.scaleY = viewcanvas.height / (this.maxY - this.minY) ;
	this.replot(); 	
}

ColorPlot.prototype.jpeg = function() {
	var canvas = document.getElementById(this.canvasId);
	
	var image = canvas.toDataURL("image/jpeg");
	
	document.location.href = image.replace("image/jpeg", "image/octet-stream");
}


ColorPlot.prototype.zoomoriginal = function () {
	this.view(this.originalminX,this.originalmaxX,this.originalminY,this.originalmaxY);	
}

ColorPlot.prototype.mousestartmove = function ( e ) {
	var canvas = document.getElementById(this.canvasId);
	if ( e.button == 0 ) {
		this.MOVING = true;
		var rect = canvas.getBoundingClientRect();
		this.xprev = e.clientX - rect.left;	// mouse coordinates relative to plot
		this.yprev = e.clientY - rect.top;
	}
	else {
		this.MOVING = false;
	}
}
ColorPlot.prototype.mousestopmove = function ( e ) {
	this.MOVING = false;
}
ColorPlot.prototype.mouseposition = function ( e ) {
	var canvas = document.getElementById(this.canvasId);
	var rect = canvas.getBoundingClientRect();

	var xmouse = e.clientX - rect.left;	
	var ymouse = e.clientY - rect.top;

	if ( this.MOVING ) {
		var dx = this.xprev - xmouse ;
		var dy = ymouse - this.yprev;
		if ( Math.abs( dx ) > 1 || Math.abs( dy ) > 1 ) {			
			this.translate(dx,dy);
		}
		this.xprev = xmouse;
		this.yprev = ymouse;		
	}
	else {		
		var x = xmouse / this.scaleX + this.minX;
		var y = (canvas.height  - ymouse ) / this.scaleY + this.minY;	
		return "x = " + x.toFixed(3) + ", y = " + y.toFixed(3);	
	}
}


/////////////////////////////////
// Define Object class "Plot2D"
function Plot2D(canvasId, tableId) {
	
	if(typeof(canvasId) === 'undefined' ) 
		this.canvasId = "plotcanvas2D";
	else
		this.canvasId = canvasId;
		
	if(typeof(tableId) === 'undefined' ) 
		this.tableId = "";	// No data table by default
	else
		this.tableId = tableId;

	this.minX1 = -10;
	this.maxX1 = 10;
	this.minX2 = -10;
	this.maxX2 = 10;
	this.scaleX1 ;
	this.scaleX2 ;
	this.NsamplesX1 = 500;
	this.NsamplesX2 = 500;

	// Training set 2D
	this.Xapp = new Array();
	this.Yapp = new Array();
	this.m = 0;
	
	////// Cross browser support ////
	var ctx = document.getElementById(this.canvasId).getContext("2d");
	if ( !ctx.setLineDash ) {
		ctx.setLineDash = function () {};
	}

}
	 


Plot2D.prototype.clear = function () {
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		/* put this into setscale2D : */
		this.scaleX1 = canvas.width / (this.maxX1 - this.minX1); 
		this.scaleX2 = canvas.height / (this.maxX2 - this.minX2);
	
		this.NsamplesX1 = canvas.width / 4;
		this.NsamplesX2 = canvas.height / 4;		
	
		/////
		
		ctx.fillStyle = "white";
		ctx.fillRect (0,0 , canvas.width, canvas.height);

		ctx.strokeStyle = "black";	
		ctx.lineWidth = "1";		
	
		if (this.minX2 < 0 && this.maxX2 > 0) {
	
			// X1-axis
			ctx.beginPath();
			ctx.moveTo(0,canvas.height + this.minX2  * this.scaleX2);
			ctx.lineTo(canvas.width,canvas.height + this.minX2  * this.scaleX2);
			ctx.closePath();
			ctx.stroke();
		}
	
		if (this.minX1 < 0 && this.maxX1 > 0) {
			// X2-axis
			ctx.beginPath();
			ctx.moveTo(( -this.minX1 ) * this.scaleX1 ,0);
			ctx.lineTo(( -this.minX1 ) * this.scaleX1 ,canvas.height);
			ctx.closePath();
			ctx.stroke();
		
		}
	
	}
	
	//this.clearData();
}

Plot2D.prototype.clearData = function () {
	if( this.tableId  != "" )
		document.getElementById(this.tableId).innerHTML = "<tr> <td> x1 </td><td> x2 </td><td> y </td></tr> ";
		
	while(this.Yapp.length > 0) {
		this.Yapp.pop();
		this.Xapp.pop();
	}
	this.m = 0;
}

Plot2D.prototype.levelcurve = function (f, level ) {

	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		var started = false; 

		ctx.fillStyle = "rgb(0,0,200)";
		ctx.strokeStyle = "rgb(0,0,200)";
		//ctx.lineWidth="3";
		//ctx.beginPath();
		
		var Y = new Array();
		var i = 0;
		var j = 0;
		
		// Compute function values
		for(var x1=this.minX1; x1 < this.maxX1; x1 += (this.maxX1-this.minX1) / this.NsamplesX1 ) {
			Y[i] = new Array(); 
			for(var x2=this.minX2; x2 < this.maxX2; x2 += (this.maxX2-this.minX2) / this.NsamplesX2 ) {
				var x = [x1, x2];
				Y[i][j] =  f(x) ;
				j++;
			}
			i++;
		}			

		// Draw level curve
		var i = 0;
		var j = 0;
		for(var x1=this.minX1; x1 < this.maxX1; x1 += (this.maxX1-this.minX1) / this.NsamplesX1 ) {
			for(var x2=this.minX2; x2 < this.maxX2; x2 += (this.maxX2-this.minX2) / this.NsamplesX2 ) {
		
				if ( ( j > 0 && Y[i][j] >= level && Y[i][j-1] <= level ) 
					|| ( j > 0 && Y[i][j] <= level && Y[i][j-1] >= level )  
					|| ( i > 0 && Y[i][j] <= level && Y[i-1][j] >= level )  
					|| ( i > 0 && Y[i][j] >= level && Y[i-1][j] <= level )  )	{
				
					/*
					if ( !started ){						
						 ctx.moveTo(( x1-this.minX1 ) * this.scaleX1, canvas.height/2 - ( x2 * this.scaleX2 ));
						 started = true;
					}
					else
						ctx.lineTo(( x1-this.minX1 ) * this.scaleX1 , canvas.height/2 - ( x2 * this.scaleX2 ));
					*/
					ctx.fillRect (( x1-this.minX1 ) * this.scaleX1 - 2, canvas.height - ( ( x2 - this.minX2) * this.scaleX2 ) - 2, 4, 4);
					
				}
				j++;
			}
			
			i++;
		}
//		ctx.closePath();
		//ctx.stroke();
	
	}
}


Plot2D.prototype.colormap = function(f) {

	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		var started = false; 

		var maxf = -Infinity;
		var minf = +Infinity;
		var Y = new Array();
		var i = 0;
		var j = 0;
		
		// Compute function values
		for(var x1=this.minX1; x1 < this.maxX1; x1 += (this.maxX1-this.minX1) / this.NsamplesX1 ) {
			Y[i] = new Array(); 
			for(var x2=this.minX2; x2 < this.maxX2; x2 += (this.maxX2-this.minX2) / this.NsamplesX2 ) {
				var x = [x1, x2];
				Y[i][j] =  f(x) ;
				if(Y[i][j] > maxf ) {
					maxf = Y[i][j];
				}
				if(Y[i][j] < minf ) {
					minf = Y[i][j];
				}
				j++;
			}
			i++;
		}			
		
		
		var colorScale = 255 / (maxf - minf); 

		// Draw colormap
		var i = 0;
		var j = 0;
		for(var x1=this.minX1; x1 < this.maxX1; x1 += (this.maxX1-this.minX1) / this.NsamplesX1 ) {
			for(var x2=this.minX2; x2 < this.maxX2; x2 += (this.maxX2-this.minX2) / this.NsamplesX2 ) {
				if (Math.abs(Y[i][j] ) < 0.00001  ) {
					ctx.fillStyle = "black";
				}
				
				else if (Y[i][j] < 0 ) {
					ctx.fillStyle = "rgba(0,0," + (255 - Math.floor((Y[i][j] - minf) * colorScale )) + ", 0.9)";					
				}
				else {
					//ctx.fillStyle = "rgba(" + Math.floor((Y[i][j] - minf) * colorScale ) + ",0,255,0.5)";
					ctx.fillStyle = "rgba(" + Math.floor((Y[i][j] - minf) * colorScale ) + ",0,0, 0.9)";
				}
				ctx.fillRect (( x1-this.minX1 ) * this.scaleX1 - 2, canvas.height - ( ( x2 - this.minX2) * this.scaleX2 )- 2, 4, 4);		
				//margin
				if (Math.abs(Y[i][j] ) < 1 ) {
					ctx.fillStyle = "rgba(200,200,200,0.5)";
					ctx.fillRect (( x1-this.minX1 ) * this.scaleX1 - 2, canvas.height - ( ( x2 - this.minX2) * this.scaleX2 )- 2, 4, 4);	
				}			
				
				j++;
			}			
			i++;
		}
	
	}
}

Plot2D.prototype.point = function (x1, x2, color_idx, opacity,  radius ) {

	if (typeof(opacity) === 'undefined')
		opacity = 1.1; 
	if (typeof(radius) === 'undefined')
		radius = 5; 
	

	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		if (opacity < 1.0 ) 
			setcolortransparent(ctx, color_idx, opacity);
		else
			setcolor(ctx, color_idx);
		
		ctx.beginPath();
		ctx.arc( ( x1-this.minX1 ) * this.scaleX1 , canvas.height - ( x2 - this.minX2) * this.scaleX2, radius, 0, 2 * Math.PI , true);
		// arc( x, y, radius, agnlestart, angleend, sens)
	
		ctx.closePath();
		ctx.fill();
	}
}


Plot2D.prototype.pointmouse = function  (event ) {

	if(event.button == 0) {
		event.preventDefault();	
	
		var canvas = document.getElementById(this.canvasId);
		if (canvas.getContext) {
			var ctx = canvas.getContext("2d");
			var rect = canvas.getBoundingClientRect();

			var x = event.clientX - rect.left;	// mouse coordinates relative to plot
			var y = event.clientY - rect.top;
			var color_idx = parseInt(document.getElementById("selectcolor").value);
			
			// Add to training set
			var etiquette = color_idx; 
			var x1 = x / this.scaleX1 + this.minX1;
			var x2 =  (canvas.height  - y) / this.scaleX2 + this.minX2;
			// plot point		

			this.point(x1,x2,color_idx );	
		
			this.Xapp[this.m] = new Array(); 
			this.Xapp[this.m][0] = x1;
			this.Xapp[this.m][1] = x2; 
			this.Yapp[this.m] = etiquette; 
			this.m++;
		
		
			if ( this.tableId != "" ) {
				// add to table of points
				var t = document.getElementById(this.tableId); 
				t.innerHTML += "<tr><td>"+ x1.toFixed(2) + "</td><td>" + x2.toFixed(2) + "</td><td>" + etiquette + "</td></tr>";
			}
		}
	}
}

Plot2D.prototype.plot_data = function () {
	if (this.m != this.Yapp.length )
		this.m = this.Yapp.length;
		
   	for(var i=0;i < this.m ;i++) {
		this.point (this.Xapp[i][0], this.Xapp[i][1], this.Yapp[i] );
	}
}

Plot2D.prototype.plot_vector = function(start_x1,start_x2, end_x1,end_x2, vectorname, veccolor) {
	if(typeof(veccolor) === 'undefined') {
		veccolor = 0;
	}
	
	start_x1 = (start_x1 - this.minX1) * this.scaleX1;
	end_x1 = (end_x1 - this.minX1) * this.scaleX1;	
	start_x2 = (start_x2 - this.minX2) * this.scaleX2;
	end_x2 = (end_x2 - this.minX2) * this.scaleX2;	
	
	var theta1 = Math.atan((end_x2 - start_x2)/(end_x1 - start_x1)); // angle entre vecteur et axe X1
	var theta2 = Math.atan((end_x1 - start_x1) /(end_x2 - start_x2)); // angle entre vecteur et axe X2	
	
	var arrowsize = 10;
	var arrow1_x1 = end_x1 ; 
	var arrow1_x2 = end_x2 ; 
	
	var arrow2_x1 = end_x1 ;
	var arrow2_x2 = end_x2 ;
	
	if ( end_x2 >= start_x2) {
		arrow1_x1 -= arrowsize*Math.sin(theta2 - Math.PI/12);
		arrow1_x2 -= arrowsize*Math.cos(theta2 - Math.PI/12);
	}
	else {
		arrow1_x1 += arrowsize*Math.sin(theta2 - Math.PI/12);
		arrow1_x2 += arrowsize*Math.cos(theta2 - Math.PI/12);
	}		
	if ( end_x1 >= start_x1 ) {
		arrow2_x1 -= arrowsize*Math.cos(theta1 - Math.PI/12);	
		arrow2_x2 -= arrowsize*Math.sin(theta1 - Math.PI/12);			
	}
	else {
		arrow2_x1 += arrowsize*Math.cos(theta1 - Math.PI/12);	
		arrow2_x2 += arrowsize*Math.sin(theta1 - Math.PI/12);		
	}
	
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		ctx.lineWidth="1";
		setcolor(ctx,veccolor);
		
		ctx.beginPath();
		ctx.moveTo(start_x1,canvas.height - start_x2);
		ctx.lineTo(end_x1,canvas.height - end_x2);
		ctx.lineTo(arrow1_x1,canvas.height - arrow1_x2);
		ctx.lineTo(arrow2_x1,canvas.height - arrow2_x2);
		ctx.lineTo(end_x1,canvas.height - end_x2);
		ctx.stroke();
		ctx.fill();

		if(typeof(vectorname) !== 'undefined') {
			ctx.lineWidth="1";
			var dx =5;
			if ( end_x1 < start_x1)
				dx = -15;

			ctx.strokeText(vectorname, end_x1 + dx,canvas.height - end_x2);
		}
	}
}


Plot2D.prototype.plot_line = function(start_x1,start_x2, end_x1,end_x2, linename, linecolor, dashed, linewidth) {
	if(typeof(linecolor) === 'undefined') {
		linecolor = 0;
	}
	if(typeof(dashed) === 'undefined') {
		dashed = false;
	}
	if(typeof(linewidth) === 'undefined') {
		linewidth = 1;
	}
	
	start_x1 = (start_x1 - this.minX1) * this.scaleX1;
	end_x1 = (end_x1 - this.minX1) * this.scaleX1;	
	start_x2 = (start_x2 - this.minX2) * this.scaleX2;
	end_x2 = (end_x2 - this.minX2) * this.scaleX2;	
	
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		ctx.lineWidth=""+linewidth;
		setcolor(ctx,linecolor);
		if (dashed) {
			ctx.setLineDash([5]);
			//ctx.lineWidth="1";
		}
		ctx.beginPath();
		ctx.moveTo(start_x1,canvas.height - start_x2);
		ctx.lineTo(end_x1,canvas.height - end_x2);
		ctx.stroke();
		ctx.setLineDash([1, 0]);
		
		if(typeof(linename) !== 'undefined') {
			if ( linename != "" ) {
				ctx.lineWidth="1";
				ctx.strokeText(linename, (end_x1 + start_x1)/2 - 10 ,canvas.height - 10 - (end_x2+start_x2)/2);
			}
		}
	}
}
Plot2D.prototype.plot_classifier = function (w, b, coloridx, disappear) {
	if (typeof(disappear) === 'undefined')
		var disappear = false; 
	if (typeof(coloridx) === 'undefined')
		var coloridx = 0; 

	var x1 = this.minX1;
	var x2 = this.maxX1;
	var y1;
	var y2;
	
	if (w[1] != 0) {
		y1 = (-b - w[0]*x1) / w[1];
		y2 = (-b - w[0]*x2) / w[1];
	}
	else {
		x1 = -b / w[0];
		x2 = -b / w[0];
		y1 = this.minX2;
		y2 = this.maxX2;
	}
	
	var canvas = document.getElementById(plot.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
	
		ctx.lineWidth="3";
		if ( disappear ) 
			ctx.strokeStyle = "grey";
		else
			setcolor(ctx, coloridx);
			
		ctx.setLineDash([1, 0]);
		ctx.beginPath();		
		ctx.moveTo(( x1-this.minX1 ) * this.scaleX1 , canvas.height/2 - ( y1 * this.scaleX2 ));
		ctx.lineTo(( x2-this.minX1 ) * this.scaleX1 , canvas.height/2 - ( y2 * this.scaleX2 ));
		ctx.stroke();


	}

	
}

Plot2D.prototype.coord2datavector = function(x1,x2) {
	var canvas = document.getElementById(this.canvasId); 
	var x = [0,0] ;
	x[0] = ( x1 / this.scaleX1 ) + this.minX1 ;
	x[1] = (-( x2-canvas.height) / this.scaleX2 ) + this.minX2;
	return x;
}
Plot2D.prototype.plotmathjax = function(stringindex, x, y) {
			
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");

		var label = document.getElementById("jaxstring"+stringindex);
		label.style.top = canvas.height - ( y - this.minX2) * this.scaleX2  + canvas.offsetTop;
		label.style.left = (x - this.minX1) * this.scaleX1 + canvas.offsetLeft;	
		label.style.visibility = "visible"; 
	}
}
Plot2D.prototype.clearmathjax = function(stringindex) {
	var label = document.getElementById("jaxstring"+stringindex);
	label.style.visibility = "hidden"; 
	
}
	 
Plot2D.prototype.text = function (x1,x2,txt) {
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		ctx.lineWidth="0.5"; 
		ctx.strokeStyle = "black";
		ctx.strokeText(txt,  ( x1-this.minX1 ) * this.scaleX1 , canvas.height - ( x2 - this.minX2) * this.scaleX2);
	}
}

///////////////////////////////
/// Plot 3D ///////////////////
///////////////////////////////
function Plot3D(canvasId) {
	
	if(typeof(canvasId) === 'undefined' ) 
		this.canvasId = "plotcanvas3D";
	else
		this.canvasId = canvasId;

	var canvas =  document.getElementById(this.canvasId);

	this.minX1 = -10;
	this.maxX1 = 10;
	this.minX2 = -10;
	this.maxX2 = 10;
	this.minX3 = -10;
	this.maxX3 = 10;
	this.scaleX1 ;
	this.scaleX2 ;
	this.scaleX3 ;
	this.NsamplesX1 = 50;
	this.NsamplesX2 = 50;
	this.NsamplesX3 = 50;	

	this.axisNameX1 = "x1";
	this.axisNameX2 = "x2";
	this.axisNameX3 = "x3";

	// Training set 3D
	this.X = new Array();
	this.Y = new Array();
	
	// other stuff to plot
	this.lines = new Array();
	this.planes = new Array();
	this.spheres = new Array();
	
	// 2D Graphics
	this.view2D = new Array();
	this.viewminX1 = -10;
	this.viewmaxX1 = 10;
	this.viewminX2 = -10;
	this.viewmaxX2 = 10;
	this.viewscaleX1 = canvas.width / (this.viewmaxX1 - this.viewminX1);
	this.viewscaleX2 = canvas.width / (this.viewmaxX2 - this.viewminX2);
	
	this.angleX = 0.0;//- Math.PI/6; // rotations around axis
	this.angleY = 0.0;
	this.angleZ = 0.0;// - Math.PI/8;

	this.cameraDistance = 20;

	// Mouse animation
	this.ROTATING = false;
	this.mouseX = 0;
	this.mouseY = 0;

	// automatic animation
	this.animation = null; 
	this.animateAuto = 0; 	// if 0: do not relaunch animation after mouse released 
							// if > 0: samplingrate of animation
	
	////// Cross browser support ////
	var ctx = document.getElementById(this.canvasId).getContext("2d");
	if ( !ctx.setLineDash ) {
		ctx.setLineDash = function () {};
	}
	
	if(window.addEventListener)
        canvas.addEventListener('DOMMouseScroll', this.mousezoom, false);//firefox
 
    //for IE/OPERA etc
    canvas.onmousewheel = this.mousezoom;

}


Plot3D.prototype.test = function() {
	this.X.push([5,0,0]);
	this.X.push([0,5,0]);
	this.X.push([0,0,5]);
	this.Y.push(1);
	this.Y.push(2);
	this.Y.push(3);
	this.X.push([2,0,0]);
	this.X.push([0,-6,0]);
	this.X.push([0,0,2]);
	this.Y.push(1);
	this.Y.push(2);
	this.Y.push(3);
	
	this.X.push([5,5,5]);
	this.Y.push(3);
	
	
	this.sphere([5,-5, 1], 50, "", 1) ;
	this.sphere([-5,5, -3], 30, "", 3) ;
	
	this.replot();
	this.animateAuto = 100;
	this.animate(50);
}
Plot3D.prototype.computeRanges = function () {

	var i;
	for (i=0;i<this.Y.length ; i++) {
		var norm = Math.sqrt( this.X[i][0]*this.X[i][0] + this.X[i][1]*this.X[i][1] + this.X[i][2]*this.X[i][2] ) 
		if ( norm > this.maxX2 ) {
			this.maxX2 = norm;
			this.minX2 = -norm;
		}
	}	
}	

Plot3D.prototype.replot = function() {
	// Compute 2D coordinates from 3D ones
	
	
	var x1;
	var x2;
	var distance;
	var opacity;
	var radius;
	var res;
	
	var i;	
	var maxDistance = this.cameraDistance + this.maxX2 - this.minX2; 

	this.clear();
	
	// plotorigin
	this.point2D(0, 0, 0 , 1.0, 3 ) ; 
	
	// plot axis
	this.line([ -1, 0, 0], [10, 0,0] , this.axisNameX1);
	this.line([ 0, -1, 0], [0, 10 ,0] ,this.axisNameX2);
	this.line([ 0, 0, -1], [0, 0,10] , this.axisNameX3);
	
	// plot points
	for (i=0;i<this.Y.length ; i++) {
	
		res = this.project(this.X[i] );
		x1 = res[0];
		x2 = res[1];
		distance = res[2];
	
		
		if ( distance < maxDistance ) 
			opacity = ( distance / maxDistance ) ;
		else
			opacity = 1.0;
			
		radius = Math.floor(2 + (1 - opacity) * 10);
				
		this.point2D(x1, x2, this.Y[i] , opacity, radius ) ; 
	}
	
	// plot lines
	for (i=0;i<this.lines.length; i++) {
		this.line(this.lines[i][0],this.lines[i][1],this.lines[i][2],this.lines[i][3]);
	}
	
	// plot planes
	for (i=0;i<this.planes.length; i++) {
		this.drawplane(this.planes[i][0],this.planes[i][1],this.planes[i][2],this.planes[i][3]);
	}
	
	// plot spheres 
	//  plot the most distant ones first !!! 
	var distances = new Array();
	for (i=0;i<this.spheres.length; i++) {	
		var res = this.project( this.spheres[i][0] ); 
		distances[i] = res[2];
	}
	for (var n=0;n<this.spheres.length; n++) {
		var idx = 0;
		for ( i=1; i< this.spheres.length; i++) {
			if ( distances[i] > distances[idx] )
				idx = i;
		}
		this.drawsphere( this.spheres[idx][0], this.spheres[idx][1], this.spheres[idx][2], this.spheres[idx][3] );
		distances[idx] = -1;			
	}
}
Plot3D.prototype.clear = function(  ) {
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0,0,canvas.width,canvas.height);
	}
}
Plot3D.prototype.clear_data = function(  ) {
	while (this.Y.length > 0) {
		this.Y.pop();
		this.X.pop();
	}
}
Plot3D.prototype.clear_planes = function(  ) {
	while(this.planes.length > 0) {
		this.planes.pop();
	}
}

Plot3D.prototype.rotateX = function( deltaangle ) {
	this.angleX += deltaangle; 
	this.replot();
}

Plot3D.prototype.rotateY = function( deltaangle ) {
	this.angleY += deltaangle; 
	this.replot();
}
Plot3D.prototype.rotateZ = function( deltaangle , do_replot) {
	if ( typeof(do_replot) == "undefined" )
		var do_replot = true;
		
	this.angleZ += deltaangle; 
	if ( do_replot )
		this.replot();
}

Plot3D.prototype.mouserotation = function(e) {

	if ( this.ROTATING ) {
		e.preventDefault();
		var dx = e.clientX - this.mouseX;	
		var dy = e.clientY - this.mouseY;	
		this.mouseX = e.clientX;
		this.mouseY = e.clientY;
		
		if ( Math.abs(dx) > 0.2 ) 
			this.rotateZ(dx / 20, !(Math.abs(dy) > 0.2) );
		if ( Math.abs(dy) > 0.2 ) 
			this.rotateX(dy / 20);
	}
}
Plot3D.prototype.mousedown = function(e) {
	e.preventDefault();
	this.ROTATING = true;
	this.mouseX = e.clientX;
	this.mouseY = e.clientY;
	
	this.animateStop();
}

Plot3D.prototype.mouseup = function(e) {
	e.preventDefault();
	this.ROTATING = false;
	if ( this.animateAuto > 0 ) {
		this.animate( this.animateAuto );
	}
}
Plot3D.prototype.mousezoom = function(e) {
	// !!! use plot3 instead of this due to event handler...
	
	var delta = 0;
 
    if (!e) 
    	e = window.event;
 	
 	e.preventDefault();
	
    // normalize the delta
    if (e.wheelDelta) {
         // IE and Opera
        delta = e.wheelDelta / 30;
    } 
    else if (e.detail) { 
        delta = -e.detail ;
    }
 
	plot3.cameraDistance -= delta ;
	
	if ( plot3.cameraDistance < 5 ) {
		plot3.cameraDistance = 5;
	}
	else if ( plot3.cameraDistance > 100 ) 
		plot3.cameraDistance = 100;
	
	plot3.replot();
}

Plot3D.prototype.project = function ( x3D ) {
	/*
		x3D : points in World coordinate system
		Camera / view coordinate system initialized like World system
		Camera is fixed to (0,cameraDistance,0) in camera system
		
		1. rotate World in camera system
		2. project camera system to 2D XZ plane since camera on Y-axis
		3. distance to camera = cameraDistance + Y 
		
	
	*/
	
	// 1. rotation
	var tmpX = new Array(3); 
	// rotation around X-axis:
	tmpX[0] = x3D[0]; // does not change X-coordinate
	tmpX[1] = Math.cos(this.angleX) * x3D[1] - Math.sin(this.angleX) * x3D[2];
	tmpX[2] = Math.sin(this.angleX) * x3D[1] + Math.cos(this.angleX) * x3D[2];	
	
	// rotation around Y-axis:
	var tmpY = new Array(3); 
	tmpY[0] = Math.cos(this.angleY) * tmpX[0] - Math.sin(this.angleY) * tmpX[2];
	tmpY[1] = tmpX[1];
	tmpY[2] = Math.sin(this.angleY) * tmpX[0] + Math.cos(this.angleY) * tmpX[2];	

	// rotation around Z-axis:
	var tmpZ = new Array(3); 
	tmpZ[0] = Math.cos(this.angleZ) * tmpY[0] - Math.sin(this.angleZ) * tmpY[1];
	tmpZ[1] = Math.sin(this.angleZ) * tmpY[0] + Math.cos(this.angleZ) * tmpY[1];	
	tmpZ[2] = tmpY[2];
	
	// Scaling
	var scale = ( this.cameraDistance/20 ) ;
	tmpZ[0] /= scale;
	tmpZ[1] /= scale;
	tmpZ[2] /= scale;		
	
	// Project to 2D plane 	
	var x1 = tmpZ[0];
	var x2 = tmpZ[2]; 
	var distance = this.cameraDistance + tmpZ[1];

	return [x1,x2, distance];
}

Plot3D.prototype.line = function( start, end, linename, linecolor, dashed, linewidth ) {
	var start_x1;
	var start_x2;

	var res = this.project(start);
	start_x1 = res[0];
	start_x2 = res[1];
	
	var end_x1;
	var end_x2;

	res = this.project(end);
	end_x1 = res[0];
	end_x2 = res[1];
	
	this.line2D(start_x1, start_x2, end_x1, end_x2, linename, linecolor, dashed, linewidth);
}
Plot3D.prototype.plot_line = function( start, end, linename, color ) {
	if (typeof(color) === 'undefined')
		var color = 0; 

	this.lines.push([start, end, linename, color]);
	this.line( start, end, linename, color );
}
Plot3D.prototype.plane = function( start, end, polyname, color ) {
	if (typeof(color) === 'undefined')
		var color = 3; 
	if (typeof(polyname) === 'undefined')
		var polyname = "";
	
	this.planes.push([start, end, polyname, color]);
	this.drawplane( start, end, polyname, color );
}
Plot3D.prototype.drawplane = function( start, end, polyname, color ) {
	var res;
	var corner1 = new Array(3);// 2 other corners
	var corner2 = new Array(3);
	corner1[0] = start[0];
	corner1[1] = end[1];
	corner1[2] = start[2];
	corner2[0] = end[0];
	corner2[1] = start[1];
	corner2[2] = end[2];
	
	res = this.project(start);		
	var start_x1 = res[0];
	var start_x2 = res[1];
	
	res = this.project(end);		
	var end_x1 = res[0];
	var end_x2 = res[1];
	
	res = this.project(corner1);		
	var corner1_x1 = res[0];
	var corner1_x2 = res[1];
 	res = this.project(corner2);		
	var corner2_x1 = res[0];
	var corner2_x2 = res[1];
 			
	this.polygone2D( [ start_x1, corner1_x1, end_x1, corner2_x1], [ start_x2, corner1_x2, end_x2, corner2_x2], polyname, color);
}

Plot3D.prototype.sphere = function( center, radius, spherename, color ) {
	if (typeof(color) === 'undefined')
		var color = 1; 
	if (typeof(spherename) === 'undefined')
		var spherename = "";
	this.spheres.push([center, radius, spherename, color ]);
	this.drawsphere( center, radius, spherename, color );
}
Plot3D.prototype.drawsphere = function( center, radius, spherename, color ) {
	var res;
	res = this.project(center);		
	var x1 = res[0];
	var x2 = res[1];
	var distance = res[2];
	
	if ( distance >= 0 ) {
		var opacity = 1.0;
		var maxDistance = this.cameraDistance + this.maxX2 - this.minX2; 
	
		if ( distance < maxDistance ) 
			opacity = 0.5 * ( distance / maxDistance ) ;

		var radius2D = Math.floor(radius * ( 0 +3* (1 - opacity)*(1 - opacity) ) );

		this.disk2D( x1, x2, radius2D, spherename, color, opacity);
	
	}
}

Plot3D.prototype.point2D = function (x1, x2, color_idx, opacity,  radius ) {

	if ( x1 >= this.viewminX1 && x1 <= this.viewmaxX1 && x2 >= this.viewminX2 && x2 <= this.viewmaxX2 ) {

		if (typeof(opacity) === 'undefined')
			var opacity = 1.1; 
		if (typeof(radius) === 'undefined')
			var radius = 5; 
	

		var canvas = document.getElementById(this.canvasId);
		if (canvas.getContext) {
			var ctx = canvas.getContext("2d");
		
			if (opacity < 1.0 ) 
				setcolortransparent(ctx, color_idx, opacity);
			else
				setcolor(ctx, color_idx);
		
			ctx.beginPath();
			ctx.arc( ( x1-this.viewminX1 ) * this.viewscaleX1 , canvas.height - ( x2 - this.viewminX2) * this.viewscaleX2, radius, 0, 2 * Math.PI , true);
			// arc( x, y, radius, agnlestart, angleend, sens)
	
			ctx.closePath();
			ctx.fill();
		}
	}
}
Plot3D.prototype.line2D = function(start_x1,start_x2, end_x1,end_x2, linename, linecolor, dashed, linewidth) {
	if(typeof(linecolor) === 'undefined') {
		linecolor = 0;
	}
	if(typeof(dashed) === 'undefined') {
		dashed = false;
	}
	if(typeof(linewidth) === 'undefined') {
		linewidth = 1;
	}
	
	start_x1 = (start_x1 - this.viewminX1) * this.viewscaleX1;
	end_x1 = (end_x1 - this.viewminX1) * this.viewscaleX1;	
	start_x2 = (start_x2 - this.viewminX2) * this.viewscaleX2;
	end_x2 = (end_x2 - this.viewminX2) * this.viewscaleX2;	
	
	
	var canvas = document.getElementById(this.canvasId);

	if ( start_x1 < 0 ) 
			start_x1 = 0;
	if ( start_x1 >= canvas.width ) 
			start_x1 = canvas.width-1;
	if ( start_x2 <= 0 ) 
			start_x2 = 1;
	if ( start_x2 > canvas.height ) 
			start_x2 = canvas.height;
	if ( end_x1 < 0 ) 
			end_x1 = 0;
	if ( end_x1 >= canvas.width ) 
			end_x1 = canvas.width-1;
	if ( end_x2 <= 0 ) 
			end_x2 = 1;
	if ( end_x2 > canvas.height ) 
			start_x2 = canvas.height;

	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		ctx.lineWidth=""+linewidth;
		setcolor(ctx,linecolor);
		if (dashed) {
			ctx.setLineDash([5]);
			//ctx.lineWidth="1";
		}
		ctx.beginPath();
		ctx.moveTo(start_x1,canvas.height - start_x2);
		ctx.lineTo(end_x1,canvas.height - end_x2);
		ctx.stroke();
		if (dashed) {
			ctx.setLineDash([1, 0]);
		}
		
		if(typeof(linename) !== 'undefined') {
			if (linename != "") {
				var x = -10 + (end_x1 + start_x1)/2 ;
				var y = canvas.height + 10 - (end_x2 + start_x2)/2 ; 
					
				if (linename.indexOf("jaxstring") == 0 ) {
					// put mathjaxstring as line name
					var label = document.getElementById(linename);
					label.style.fontSize = "70%";
					label.style.top = y + canvas.offsetTop;
					label.style.left = x + canvas.offsetLeft;	
					label.style.visibility = "visible"; 
				}
				else {
					ctx.lineWidth="1";
					ctx.strokeText(linename, x, y );
				}
			}
		}
	}
}

Plot3D.prototype.polygone2D = function(x1,x2, polyname, color) {
	/*
		x1,x2 : arrayx of X1,X2 coordinates of all points
	*/

	if(typeof(color) === 'undefined') {
		color = 3;
	}
	
	var i;
	// loop over all points:
	
	for (i=0;i<x1.length;i++) {
		x1[i] = (x1[i] - this.viewminX1) * this.viewscaleX1;	
		x2[i] = (x2[i] - this.viewminX2) * this.viewscaleX2;
	}
	
	var canvas = document.getElementById(this.canvasId);
	if (canvas.getContext) {
		var ctx = canvas.getContext("2d");
		
		
		setcolortransparent(ctx,color, 0.5);
		
		ctx.beginPath();
		ctx.moveTo(x1[0],canvas.height - x2[0]);
		for (i=0;i<x1.length;i++) {
			ctx.lineTo( x1[i],canvas.height - x2[i]);
		}
		ctx.fill();
		
		if(typeof(polyname) !== 'undefined') {
			if (polyname != "") {
				var x = -10 + x1[0];
				var y = canvas.height + 10 - x2[0];
					
				if (polyname.indexOf("jaxstring") == 0 ) {
					// put mathjaxstring as line name
					var label = document.getElementById(polyname);
					label.style.fontSize = "70%";
					label.style.top = y + canvas.offsetTop;
					label.style.left = x + canvas.offsetLeft;	
					label.style.visibility = "visible"; 
				}
				else {
					ctx.lineWidth="1";
					ctx.strokeText(polyname, x, y );
				}
			}
		}
	}
}

Plot3D.prototype.disk2D = function (x1, x2, radius, spherename, color, opacity ) {
	if (typeof(opacity) === 'undefined')
		var opacity = 1.1; 
	if (typeof(radius) === 'undefined')
		var radius = 5; 
	
	if ( x1 + radius >= this.viewminX1 && x1 - radius <= this.viewmaxX1 && x2 + radius >= this.viewminX2 && x2 - radius <= this.viewmaxX2 ) {
		
		var canvas = document.getElementById(this.canvasId);
		if (canvas.getContext) {
			var ctx = canvas.getContext("2d");
			var x1view =  ( x1-this.viewminX1 ) * this.viewscaleX1 ;
			var x2view =  canvas.height - ( x2 - this.viewminX2) * this.viewscaleX2;
		
			if (opacity < 1.0 ) 
				setcolortransparentgradient(ctx, color, opacity, Math.sqrt(x1view*x1view+x2view*x2view) + radius);
			else
				setcolorgradient(ctx, color,  Math.sqrt(x1view*x1view+x2view*x2view) + radius);
		
			ctx.beginPath();
			ctx.arc( x1view, x2view, radius, 0, 2 * Math.PI , true);
			ctx.closePath();
			ctx.fill();
			
			if(typeof(spherename) !== 'undefined') {
				if (spherename != "") {
					var x = -10 + x1view;
					var y = 10 + x2view;
					
					if (spherename.indexOf("jaxstring") == 0 ) {
						// put mathjaxstring as line name
						var label = document.getElementById(spherename);
						label.style.fontSize = "70%";
						label.style.top =  x2view  + canvas.offsetTop;
						label.style.left = x1view  + canvas.offsetLeft;	
						label.style.visibility = "visible"; 
					}
					else {
						var words = spherename.split("*");
						ctx.textAlign = "center";	// center of text appear at x position
						var txtsize = Math.floor(0.2 * radius) ;
						var tmpfont = ctx.font;
						ctx.font = txtsize + "pt sans-serif";
						ctx.fillStyle = "black";
		
						if ( words.length == 1 ) {
							ctx.fillText( spherename, x1view  , x2view  ) ;
						}
						else {
							for (var i = 0; i< words.length; i++) {
								ctx.fillText( words[i], x1view  ,x2view - (words.length/2 - i - 0.5)* (1.5 * txtsize)) ;
							}
						}
						ctx.font = tmpfont;
					}
				}
			}
		}
	}
}
Plot3D.prototype.animate = function(samplingRate) {
	if ( typeof(samplingRate) === 'undefined' ) 
		var samplingRate = this.animateAuto ;
		
		
	this.animateStop(); // make sure a single animation runs
		
	var p3 = this;
	this.animation = setInterval( function () {
			p3.rotateZ(0.01);	// cannot use "this" here => plot3
		}, samplingRate
	);
	
}
Plot3D.prototype.animateStop = function() {
	if ( this.animation != null ) {
		clearInterval( this.animation );
		this.animation = null;
	}
	
}
Plot3D.prototype.isInSphere = function (x, y, z, sphere) {
	var dx = (x - sphere[0][0]);
	var dy = (y - sphere[0][1]);
	var dz = (z - sphere[0][2]);		
	var norm2 = dx*dx+dy*dy+dz*dz;
	
	if ( norm2 <= sphere[1]*sphere[1] )
		return true;
	else 
		return false;

}

////////////////////////////////////////
// General canvas tools 	 
function setcolor(ctx, color_idx) {
	if( color_idx > 10 ) {
		setcolortransparent(ctx, color_idx - 10, 0.5);
		return;
	}
	
	switch(color_idx) {
	case -1: 
		ctx.fillStyle = "white";			
		ctx.strokeStyle = "white";
		break;

	case 0: 
		ctx.fillStyle = "rgb(0,0,0)";
		ctx.strokeStyle = "rgb(0,0,0)";
		break;
	case 1: 
		ctx.fillStyle = "rgb(0,0,200)";	
		ctx.strokeStyle = "rgb(0,0,200)";					
		break;
	case 2: 
		ctx.fillStyle = "rgb(200,0,0)";			
		ctx.strokeStyle = "rgb(200,0,0)";			
		break;
	case 3: 
		ctx.fillStyle = "rgb(0,200,0)";
		ctx.strokeStyle = "rgb(0,200,0)";						
		break;
	case 4: 
		ctx.fillStyle = "rgb(200,0,200)";			
		ctx.strokeStyle = "rgb(200,0,200)";
		break;
	case 5: 
		ctx.fillStyle = "rgb(255,255,0)";			
		ctx.strokeStyle = "rgb(255,255,0)";
		break;
	case 6: 
		ctx.fillStyle = "rgb(0,255,255)";			
		ctx.strokeStyle = "rgb(0,255,255)";
		break;
	case 7: 
		ctx.fillStyle = "rgb(102,51,0)";			
		ctx.strokeStyle = "rgb(102,51,0)";
		break;
	case 8: 
		ctx.fillStyle = "rgb(204,51,0)";			
		ctx.strokeStyle = "rgb(204,51,0)";
		break;
	case 9: 
		ctx.fillStyle = "rgb(255,102,204)";			
		ctx.strokeStyle = "rgb(255,102,204)";
		break;
	case 10: 
		ctx.fillStyle = "rgb(120,120,120)";			
		ctx.strokeStyle = "rgb(120,120,120)";
		break;
	
	default:
		ctx.fillStyle = "rgb(0,0,200)";			
		ctx.strokeStyle = "rgb(0,0,200)";			
		break;															
	}

}
	 
function setcolortransparent(ctx, color_idx, opacity) {
	switch(color_idx) {
	case 0: 
		ctx.fillStyle = "rgba(0,0,0," + opacity +" )";
		ctx.strokeStyle = "rgba(0,0,0," + opacity +" )";
		break;
	case 1: 
		ctx.fillStyle = "rgba(0,0,200," + opacity +" )";
		ctx.strokeStyle = "rgba(0,0,200," + opacity +" )";
		break;
	case 2: 
		ctx.fillStyle = "rgba(200,0,0," + opacity +" )";
		ctx.strokeStyle = "rgba(200,0,0," + opacity +" )";
		break;
	case 3: 
		ctx.fillStyle = "rgba(0,200,0," + opacity +" )";
		ctx.strokeStyle = "rgba(0,200,0," + opacity +" )";
		break;
	case 4: 
		ctx.fillStyle = "rgba(200,0,200," + opacity +" )";
		ctx.strokeStyle = "rgba(200,0,200," + opacity +" )";
		break;
	case 5: 
		ctx.fillStyle = "rgba(255,255,0," + opacity +" )";
		ctx.strokeStyle = "rgba(255,255,0," + opacity +" )";
		break;
	case 6: 
		ctx.fillStyle = "rgba(0,255,255," + opacity +" )";		
		ctx.strokeStyle = "rgba(0,255,255," + opacity +" )";
		break;
	case 7: 
		ctx.fillStyle = "rgba(102,51,0," + opacity +" )";			
		ctx.strokeStyle = "rgba(102,51,0," + opacity +" )";
		break;
	case 8: 
		ctx.fillStyle = "rgba(204,51,0," + opacity +" )";			
		ctx.strokeStyle = "rgba(204,51,0," + opacity +" )";
		break;
	case 9: 
		ctx.fillStyle = "rgab(255,102,204," + opacity +" )";		
		ctx.strokeStyle = "rgba(255,102,204," + opacity +" )";
		break;
	case 10: 
		ctx.fillStyle = "rgba(120,120,120," + opacity +" )";	
		ctx.strokeStyle = "rgba(120,120,120," + opacity +" )";
		break;
	default:
		ctx.fillStyle = "rgba(0,0,200," + opacity +" )";
		ctx.strokeStyle = "rgba(0,0,200," + opacity +" )";
		break;															
	}

}

function setcolorgradient(ctx, color_idx,size) {
	if ( typeof(size) === "undefined")
		var size = 400 * Math.sqrt(2);
		
	var gradient = ctx.createRadialGradient(0,0,size, 0 , 2*Math.PI, true);
	gradient.addColorStop(1,"white");
	
	switch(color_idx) {
	case 0: 
		gradient.addColorStop(0,"rgb(0,0,0 )");
		break;
	case 1: 
		gradient.addColorStop(0,"rgb(0,0,200 )");
		break;
	case 2: 
		gradient.addColorStop(0,"rgb(200,0,0 )");
		break;
	case 3: 
		gradient.addColorStop(0,"rgb(0,200,0 )");
		break;
	case 4: 
		gradient.addColorStop(0,"rgb(200,0,200 )");
		break;
	case 5: 
		gradient.addColorStop(0,"rgb(255,255,0 )");		
		break;
	default:
		gradient.addColorStop(0,"rgb(0,0,200 )");
		break;
													
	}
	ctx.fillStyle = gradient;
}
	 
function setcolortransparentgradient(ctx, color_idx, opacity,size) {
	if ( typeof(size) === "undefined")
		var size = 400 * Math.sqrt(2);
		
	var gradient = ctx.createRadialGradient(0,0,size, 0 , 2*Math.PI, true);
	gradient.addColorStop(1,"white");
	
	switch(color_idx) {
	case 0: 
		gradient.addColorStop(0.3,"rgba(0,0,0," + opacity +" )");		
		gradient.addColorStop(0,"rgb(0,0,0 )");
		break;
	case 1: 
		gradient.addColorStop(0.3,"rgba(0,0,200," + opacity +" )");
		gradient.addColorStop(0,"rgb(0,0,200 )");
		break;
	case 2: 
		gradient.addColorStop(0.3,"rgba(200,0,0," + opacity +" )");
		gradient.addColorStop(0,"rgb(200,0,0 )");
		break;
	case 3: 
		gradient.addColorStop(0.3,"rgba(0,200,0," + opacity +" )");
		gradient.addColorStop(0,"rgb(0,200,0 )");
		break;
	case 4: 
		gradient.addColorStop(0.3,"rgba(200,0,200," + opacity +" )");
		gradient.addColorStop(0,"rgb(200,0,200 )");
		break;
	case 5: 
		gradient.addColorStop(0.3,"rgba(255,255,0," + opacity +" )");
		gradient.addColorStop(0,"rgb(255,255,0 )");		
		break;
	default:
		gradient.addColorStop(0.3,"rgba(0,0,200," + opacity +" )");
		gradient.addColorStop(0,"rgb(0,0,200 )");
		break;
													
	}
	ctx.fillStyle = gradient;
}


