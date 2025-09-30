import {style, eject, convert} from '../util/index.js'
import {Widget} from '../widget/index.js'
import {editor} from '../editor/index.js'

export const iconHandling = {

    // The title is the name of the node ... 
    // the white space has been trimmed of the text
    headerChanged(header, saved) {

        // a zero sized name is not accepted
        if (header.title.length == 0) {
            header.title = header.node.name
            return
        }
        // the space taken by the icons
        const iconSpace = 2*(style.icon.xPadding + 2*(style.icon.wIcon + style.icon.xSpacing))

        // calculate the new width for the header
        let newWidth = this.getTextWidth(header.title) + iconSpace

        // check width of the look and adapt the width of the look if neecssary
        if (newWidth > this.rect.w) this.wider(newWidth - this.rect.w)

        // change the name of the node
        header.node.name = header.title

        // if the name of the factory is empty, change it
        if (header.node.is.source && header.node.factory.fName.length < 1) 
            header.node.factory.fName = convert.nodeToFactory(header.node.name)

        // check if the node name is unique 
        editor.doc.focus.root.checkDuplicates(header.node)
    },

    // return the rectangle for the icon. Pos L = left, R = right          L1 L2 L3 .......... R3 R2 R1
    iconRect(rc, pos) {

        let xIcon = rc.x
        const st = style.icon

        switch(pos) {
            case 'L1':  xIcon = rc.x + st.xPadding;
                        break
            case 'L2':  xIcon = rc.x + st.xPadding + st.wIcon + st.xSpacing;
                        break
            case 'R1':  xIcon = rc.x + rc.w - st.xPadding - st.wIcon;
                        break
            case 'R2':  xIcon = rc.x + rc.w - st.xPadding - st.wIcon - st.xSpacing - st.wIcon;
                        break
        }

        return { x:xIcon, y:rc.y + st.yPadding, w:st.wIcon,h:st.hIcon}
    },

    addIcon(type) {

        // the icon comes in the header
        const header = this.widgets.find( w => w.is.header)

        // no title no icon
        if (!header) return

        const place = {
            'group':'L1',
            'factory':'L1',
            'link':'L1',
            'lock':'L1',
            'cog':'L2',
            'comment':'R1',
            'pulse':'R2'
        }

        // get the rectangle for the icon
        const rcIcon = this.iconRect(header.rect, place[type])

        // if there is already an icon at that place...
        const double = this.widgets.find( w => w.is.icon && w.rect.x == rcIcon.x)

        // ...remove it
        if (double) eject(this.widgets,double)

        // create the new icon
        const icon = new Widget.Icon( rcIcon, type)

        // set the render function
        icon.setRender()

        // add the icon to the widget list
        this.widgets.push(icon)
    },

    // set the link as being bad - will change the color of the link icon
    badLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'))
        if (icon) icon.is.bad = true
    },

    // set the link as being bad - will change the color of the link icon
    goodLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'))
        if (icon) icon.is.bad = false
    },

    // check if we have to change the link icon
    checkLinkIcon(type) {

        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'))

        if (icon?.type == type) return

        this.addIcon(type)
    },

    removeLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && w.type == 'link')
        if (icon) eject(this.widgets,icon)
    },

    blinkToWarn() {

        // time is in ms
        const blinkFunction = (time) => {

            // check the time
            if (time - lastTime >= blinkRate) {

                // change the color
                icon.is.highLighted = !icon.is.highLighted
                header.is.highLighted = !header.is.highLighted

                // redraw
                editor.redraw()

                // save the time
                lastTime = time

                // increment count
                count++
            }
    
            // Continue fro the number of blinks requested
            if (count < maxBlinks) {
                requestAnimationFrame(blinkFunction);
            }
            else {
                icon.is.highLighted = false
                header.is.highLighted = false
                editor.redraw()
            }
        };

        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'))
        const header = this.widgets.find( w => w.is.header)

        if (!icon || !header) return

        const maxBlinks = style.icon.nBlinks * 2
        const blinkRate = style.icon.blinkRate;

        let count = 0
        let lastTime = 0;
    
        // schedule the first blink function
        requestAnimationFrame(blinkFunction);
    },
}
