import {HalftoneCmyk} from '@paper-design/shaders-react'

import footerTexture from './-images/footer-bg.jpg?w=1600&responsive'

export function FooterImage({className}: {className?: string}) {
	return (
		<HalftoneCmyk
			className={className}
			width="100%"
			height="100%"
			image={footerTexture.src}
			colorBack="#d4d4d4"
			colorC="#737373"
			colorM="#737373"
			colorY="#737373"
			colorK="#262626"
			size={0.01}
			gridNoise={0.6}
			type="dots"
			softness={0.2}
			contrast={2}
			floodC={0}
			floodM={0}
			floodY={0}
			floodK={0.1}
			gainC={-0.15}
			gainM={-0.45}
			gainY={-0.45}
			gainK={0}
			grainMixer={0}
			grainOverlay={0.2}
			grainSize={0}
			fit="cover"
		/>
	)
}
