function make_slides(f) {
  var   slides = {};

  slides.i0 = slide({
     name : "i0",
     start: function() {
      exp.startT = Date.now();
     }
  });

  slides.instructions = slide({
    name : "instructions",
    button : function() {
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.fn_learning_test = slide({
    name : "fn_learning_test",
    present : _.shuffle([
      {x: 0.71}, {x: 0.31}
    ]),
    present_handle : function(stim) {
      $(".err").hide();
      this.stim = stim;

      $("#vertical_question").html("Different sized bugs live on different parts of the tree.<br> For a bug this size, how high on the tree does it live?");
      $("#sliders").empty();

      $("#sliders").append("<td><svg id='svg_bug'></svg></td><td id='blank'></td>");
      $("#sliders").append("<td><svg id='svg_tree'></svg></td>");
      $("#sliders").append("<td id='slider_col'><div id='vslider0' class='vertical_slider'>|</div></td>");
      var scale = 1;

      var color = "#FFFFFF"
      Ecosystem.draw("bug",
      {
        "tar1":true,
        "tar2":true,
        "prop1":1,
        "prop2":1,
        "col1":{"mean":color},
        "col2":{"mean":color},
        "col3":{"mean":color},
        "col4":{"mean":color},
        "col5":{"mean":color},
        "var":0.1
      }, "svg_bug", stim.x)

      Ecosystem.draw("tree",
      {
        "tar1":false,
        "tar2":false,
        "prop1":0.02,
        "prop2":1,
        "col1":{"mean":color},
        "col2":{"mean":color},
        "col3":{"mean":color},
        "col4":{"mean":color},
        "col5":{"mean":color},
      }, "svg_tree", 2 )

      this.init_sliders();
      exp.sliderPost = [];
    },
    button : function() {
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        // $("#svg_bug").empty();
        // var color = "#FFFFFF"
        // Ecosystem.draw("bug",
        // {
        //   "tar1":false,
        //   "tar2":false,
        //   "prop1":0.2,
        //   "prop2":1,
        //   "col1":{"mean":color},
        //   "col2":{"mean":color},
        //   "col3":{"mean":color},
        //   "col4":{"mean":color},
        //   "col5":{"mean":color},
        //   "var":0.1
        // }, "svg_bug", ui.value)
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning",
        "question" : this.stim.question,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.subj_info =  slide({
    name : "subj_info",
    submit : function(e){
      //if (e.preventDefault) e.preventDefault(); // I don't know what this means.
      exp.subj_data = {
        language : $("#language").val(),
        enjoyment : $("#enjoyment").val(),
        asses : $('input[name="assess"]:checked').val(),
        age : $("#age").val(),
        gender : $("#gender").val(),
        education : $("#education").val(),
        comments : $("#comments").val(),
      };
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.thanks = slide({
    name : "thanks",
    start : function() {
      exp.data= {
          "trials" : exp.data_trials,
          "catch_trials" : exp.catch_trials,
          "system" : exp.system,
          "condition" : exp.condition,
          "subject_information" : exp.subj_data,
          "time_in_minutes" : (Date.now() - exp.startT)/60000
      };
      setTimeout(function() {turk.submit(exp.data);}, 1000);
    }
  });

  return slides;
}

/// init ///
function init() {
  exp.trials = [];
  exp.catch_trials = [];
  exp.condition = _.sample(["CONDITION 1", "condition 2"]); //can randomize between subject conditions here
  exp.system = {
      Browser : BrowserDetect.browser,
      OS : BrowserDetect.OS,
      screenH: screen.height,
      screenUH: exp.height,
      screenW: screen.width,
      screenUW: exp.width
    };
  //blocks of the experiment:
  exp.structure=[ "fn_learning_test","i0", "instructions", 'subj_info', 'thanks'];

  exp.data_trials = [];
  //make corresponding slides:
  exp.slides = make_slides(exp);

  exp.nQs = utils.get_exp_length(); //this does not work if there are stacks of stims (but does work for an experiment with this structure)
                    //relies on structure and slides being defined

  $('.slide').hide(); //hide everything

  //make sure turkers have accepted HIT (or you're not in mturk)
  $("#start_button").click(function() {
    if (turk.previewMode) {
      $("#mustaccept").show();
    } else {
      $("#start_button").click(function() {$("#mustaccept").show();});
      exp.go();
    }
  });

  exp.go(); //show first slide
}
