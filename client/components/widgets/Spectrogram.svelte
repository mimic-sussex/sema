<script>
	import { onMount } from 'svelte';
	// import * as GL from '@sveltejs/gl';
	// import SvelteBox from './SvelteBox.svelte';
	// import { logotype } from './images.js';

	const prime = 0xff3e00;
	const second = 0x676778;
	const flash = 0x40b3ff;

	let light = {};

	onMount(() => {
		let frame;

		const loop = () => {
			frame = requestAnimationFrame(loop);

			light.x = 3 * Math.sin(Date.now() * 0.001);
			light.y = 2.5 + 2 * Math.sin(Date.now() * 0.0004);
			light.z = 3 * Math.cos(Date.now() * 0.002);
		};

		loop();

		return () => cancelAnimationFrame(frame);
	});
</script>

<!-- <GL.Scene>
	<GL.Target id="center" location={[0, 1, 0]}/>

	<GL.OrbitControls maxPolarAngle={Math.PI / 2} let:location let:target>
		<GL.PerspectiveCamera {location} lookAt={target} near={0.01} far={1000}/>
	</GL.OrbitControls>

	<GL.AmbientLight intensity={0.3}/>
	<GL.DirectionalLight direction={[-1,-1,-1]} intensity={0.5}/>

	<GL.Sphere location={[light.x,light.y + 0.2,light.z]} u-color={second} turns={12} bands={12} scale={0.1} />
	<GL.PointLight location={[light.x,light.y,light.z]} u-color={second} intensity={0.6} />

	<GL.Plane
		u-color={0xffffff}
		location={[0,-0.01,0]}
		rotation={[-90,0,0]}
		scale={10}
	/>

	<GL.Plane
		u-color={0xff3e00}
		u-colormap="textures/svelte-logotype.png"
		location={[0,1,-6]}
		scale={[5.357548057,1,1]}
	/>

	<GL.Sphere u-color={prime} u-alpha={0.7} turns={60} bands={60} scale={0.3} location={[0,0.3,0]} />
	<GL.Sphere u-color={flash} u-alpha={0.7} turns={60} bands={60} scale={0.7} location={[-1,0.7,-1]} />
	<GL.Sphere u-color={second} u-alpha={0.7} turns={60} bands={60} scale={0.2} location={[-0.8,0.2,0]} />

	<SvelteBox location={[1,0.75,-1]} rotation={[0,30,0]} scale={1.5}/>
  </GL.Scene>-->

<div class="info">
	<h1><a target="_blank" rel="noopener" href="https://github.com/sveltejs/gl">@sveltejs/gl</a></h1>
	<p>The code for this demo lives <a target="_blank" rel="noopener" href="https://github.com/rich-harris/svelte-gl-demo">here</a></p>
</div>

<style>
	.info {
		position: absolute;
		top: 1em;
		left: 1em;
		background-color: rgba(255,255,255,0.7);
		padding: 1em;
		border-radius: 2px;
	}
</style>