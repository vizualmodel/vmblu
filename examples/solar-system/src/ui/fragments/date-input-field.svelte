<script>
    import { onMount } from 'svelte';

    // a date string
    export let value;

    // a function
    export let changed;

    let input;

    // Color to indicate good/bad input
    let savedColor = null;
    const badInputColor = "#ff0000";

    // Helper function to format the date in local time as 'YYYY-MM-DD HH:MM:SS'
    function formatDateToLocalString(date) {

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    // very flexible date and time parser
    function checkDate(inputValue) {

        // Trim the input to remove extra spaces
        const trimmedInput = inputValue.trim();
        
        // Regex to match European date format (DD/MM/YYYY or DD-MM-YYYY) and optional time (HH:MM or HH:MM:SS)
        const dateTimeRegex = /^(?<day>\d{1,2})[\/\.-](?<month>\d{1,2})[\/\.-](?<year>\d{4})(?:\s+(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2}))?)?$/;

        // Match the input against the regex
        const match = trimmedInput.match(dateTimeRegex);
        
        // yep
        let parsedDate = null
        if (match) {
            // get the components
            const { day, month, year, hour = '00', minute = '00', second = '00' } = match.groups;

            // Create a new Date object using the extracted values
            parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`);
        }
        else {

            // Try to parse using native Date (for other formats like 'Sep 12, 2021' or '2021-09-12')
            parsedDate = new Date(trimmedInput);
        }

        return isNaN(parsedDate.getTime()) ? null : formatDateToLocalString(parsedDate)
    }

    onMount(() => {
        savedColor = input.style.color;
        // field.update = () => field = field;
    });

    // function onInput(e) {
    //     input.style.width = '0px';
    //     input.style.width = input.scrollWidth > 20 ? (input.scrollWidth + 2) + 'px' : '20px';

    //     if (field.check) {
    //         input.style.color = field.check(input.value) ? savedColor : badInputColor;
    //     }
    // }

    // Trigger validation when the user presses Enter
    function onKeyDown(e) {
        // Check if the pressed key is "Enter"
        if (e.key === 'Enter') {

            // perform a date validation
            const validDate = checkDate(input.value)

            // if not ok we are done
            if (!validDate) {
                input.style.color = badInputColor
                return
            }

            // set to the formatted date
            input.value = validDate

            // call the 'changed' function if given
            input.style.color = changed ? (changed(input.value) ? savedColor : badInputColor) : savedColor
        }
    }

</script>

<style>
    input.date-field {
        --bg: #00000077;
        --bgFocus: #000;

        width: 10rem;
        background: var(--bg);
        color: var(--cInput, #ffffff);
        font-family: var(--fFixed);
        font-size: var(--fSmall);
        cursor: text;
        outline: none;
        border: none;
    }
    input:focus {
        color: var(--cLabel, #ffffff);
        background: var(--bgFocus);
    }
</style>
<input
    class="date-field"
    type="text"
    spellcheck="false"
    bind:value={value}
    bind:this={input}
    on:keydown={onKeyDown}>